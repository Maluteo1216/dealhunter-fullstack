package services

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"
)

// EmailService gestiona el envío de correos de alertas mediante API HTTP (Brevo/Resend, recomendado en Render) o SMTP (Gmail App Password)
type EmailService struct {
	brevoAPIKey  string
	resendAPIKey string
	host         string
	port         string
	user         string
	pass         string
	from         string
	frontendURL  string
}

func NewEmailService(brevoAPIKey, resendAPIKey, host, port, user, pass, from, frontendURL string) *EmailService {
	return &EmailService{
		brevoAPIKey:  strings.TrimSpace(brevoAPIKey),
		resendAPIKey: strings.TrimSpace(resendAPIKey),
		host:         strings.TrimSpace(host),
		port:         strings.TrimSpace(port),
		user:         strings.TrimSpace(user),
		pass:         strings.ReplaceAll(strings.TrimSpace(pass), " ", ""),
		from:         strings.TrimSpace(from),
		frontendURL:  strings.TrimRight(strings.TrimSpace(frontendURL), "/"),
	}
}

// IsConfigured indica si existe algún proveedor de correo configurado (Brevo, Resend o SMTP)
func (e *EmailService) IsConfigured() bool {
	if e == nil {
		return false
	}
	if e.brevoAPIKey != "" || e.resendAPIKey != "" {
		return true
	}
	return e.host != "" && e.port != "" && e.user != "" && e.pass != ""
}

// sendEmail envía un correo HTML usando el mejor transporte disponible (Brevo HTTPS -> Resend HTTPS -> SMTP con timeout)
func (e *EmailService) sendEmail(toEmail, subject, bodyHTML string) error {
	if !e.IsConfigured() {
		return fmt.Errorf("servicio de correo no configurado en el backend (agrega BREVO_API_KEY o SMTP_USER/SMTP_PASS en Render)")
	}
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return fmt.Errorf("destinatario vacío")
	}

	// 1. Prioridad: Brevo HTTP API (puerto 443 HTTPS — nunca bloqueado por Render Free Tier)
	if e.brevoAPIKey != "" {
		senderEmail := e.user
		if senderEmail == "" {
			senderEmail = "no-reply@dealhunter.app"
		}
		payload := map[string]interface{}{
			"sender": map[string]string{
				"name":  "DealHunter",
				"email": senderEmail,
			},
			"to": []map[string]string{
				{"email": toEmail},
			},
			"subject":     subject,
			"htmlContent": bodyHTML,
		}
		jsonData, _ := json.Marshal(payload)
		req, err := http.NewRequest("POST", "https://api.brevo.com/v3/smtp/email", bytes.NewBuffer(jsonData))
		if err != nil {
			return err
		}
		req.Header.Set("api-key", e.brevoAPIKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("error conectando con Brevo API: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			respBody, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("Brevo API retornó %d: %s", resp.StatusCode, string(respBody))
		}
		log.Printf("[EmailService] Correo enviado vía Brevo API a %s", toEmail)
		return nil
	}

	// 2. Resend HTTP API (puerto 443 HTTPS)
	if e.resendAPIKey != "" {
		fromHeader := e.from
		if fromHeader == "" {
			fromHeader = "DealHunter <onboarding@resend.dev>"
		}
		payload := map[string]interface{}{
			"from":    fromHeader,
			"to":      []string{toEmail},
			"subject": subject,
			"html":    bodyHTML,
		}
		jsonData, _ := json.Marshal(payload)
		req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonData))
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+e.resendAPIKey)
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("error conectando con Resend API: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			respBody, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("Resend API retornó %d: %s", resp.StatusCode, string(respBody))
		}
		log.Printf("[EmailService] Correo enviado vía Resend API a %s", toEmail)
		return nil
	}

	// 3. SMTP Directo (Gmail App Password) con timeout estricto de 8s para evitar bloqueos silenciosos
	fromHeader := e.from
	if fromHeader == "" {
		fromHeader = fmt.Sprintf("DealHunter <%s>", e.user)
	}
	encodedSubject := mime.QEncoding.Encode("UTF-8", subject)
	headers := []string{
		fmt.Sprintf("From: %s", fromHeader),
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("Subject: %s", encodedSubject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=\"UTF-8\"",
	}
	msg := []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + bodyHTML)

	addr := fmt.Sprintf("%s:%s", e.host, e.port)
	conn, err := net.DialTimeout("tcp", addr, 8*time.Second)
	if err != nil {
		return fmt.Errorf("no se pudo conectar a SMTP %s (nota: Render Free bloquea puertos SMTP; usa BREVO_API_KEY por HTTPS): %w", addr, err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))

	c, err := smtp.NewClient(conn, e.host)
	if err != nil {
		return fmt.Errorf("error creando cliente SMTP: %w", err)
	}
	defer c.Close()

	if ok, _ := c.Extension("STARTTLS"); ok {
		tlsCfg := &tls.Config{ServerName: e.host}
		if err := c.StartTLS(tlsCfg); err != nil {
			return fmt.Errorf("error en STARTTLS SMTP: %w", err)
		}
	}

	auth := smtp.PlainAuth("", e.user, e.pass, e.host)
	if err := c.Auth(auth); err != nil {
		return fmt.Errorf("error de autenticación SMTP (verifica usuario y contraseña de aplicación): %w", err)
	}
	if err := c.Mail(e.user); err != nil {
		return err
	}
	if err := c.Rcpt(toEmail); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	_ = c.Quit()

	log.Printf("[EmailService] Correo enviado vía SMTP a %s", toEmail)
	return nil
}

// SendPriceAlertEmail envía un correo HTML al usuario cuando un juego de su wishlist alcanza el precio objetivo
func (e *EmailService) SendPriceAlertEmail(
	toEmail, username, gameTitle, gameSlug, storeName string,
	triggeredPrice, targetPrice, discountPct float64,
	productURL string,
) error {
	gamePageURL := fmt.Sprintf("%s/game/%s", e.frontendURL, gameSlug)
	buyURL := productURL
	if buyURL == "" {
		buyURL = gamePageURL
	}

	safeUser := html.EscapeString(username)
	if safeUser == "" {
		safeUser = "Jugador"
	}
	safeTitle := html.EscapeString(gameTitle)
	safeStore := html.EscapeString(storeName)
	safeBuyURL := html.EscapeString(buyURL)
	safeGamePageURL := html.EscapeString(gamePageURL)

	subject := fmt.Sprintf("🔥 ¡Alerta de Precio! %s bajó a $%.2f en %s", gameTitle, triggeredPrice, storeName)

	discountBadge := ""
	if discountPct > 0 {
		discountBadge = fmt.Sprintf(`<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#065f46;color:#6ee7b7;font-weight:bold;font-size:13px;margin-left:8px;">-%.0f%% OFF</span>`, discountPct)
	}

	bodyHTML := fmt.Sprintf(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <div style="max-width:560px;margin:0 auto;background-color:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:20px 24px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">DealHunter — Alerta de Wishlist</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin-top:0;font-size:15px;color:#cbd5e1;">Hola <strong>%s</strong>,</p>
      <p style="font-size:15px;color:#cbd5e1;line-height:1.6;">
        ¡Buenas noticias! Un videojuego de tu lista de deseos ha alcanzado tu precio objetivo:
      </p>
      <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:18px;margin:18px 0;">
        <div style="font-size:18px;font-weight:700;color:#ffffff;margin-bottom:8px;">%s</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:12px;">Tienda oficial: <strong style="color:#e2e8f0;">%s</strong></div>
        <div style="display:flex;align-items:center;">
          <span style="font-size:28px;font-weight:800;color:#a5b4fc;">$%.2f USD</span>
          %s
        </div>
        <div style="font-size:12px;color:#64748b;margin-top:8px;">Tu precio objetivo configurado: $%.2f USD</div>
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a href="%s" style="display:inline-block;padding:12px 24px;background-color:#6366f1;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;font-size:14px;">Ir a la Oferta en %s</a>
        <div style="margin-top:12px;">
          <a href="%s" style="color:#94a3b8;font-size:12px;text-decoration:underline;">Ver en DealHunter</a>
        </div>
      </div>
    </div>
    <div style="padding:14px 24px;background:#0f172a;border-top:1px solid #334155;font-size:11px;color:#64748b;text-align:center;">
      Recibiste este correo porque configuraste una alerta de precio en tu cuenta de DealHunter.
    </div>
  </div>
</body>
</html>`, safeUser, safeTitle, safeStore, triggeredPrice, discountBadge, targetPrice, safeBuyURL, safeStore, safeGamePageURL)

	err := e.sendEmail(toEmail, subject, bodyHTML)
	if err != nil {
		log.Printf("[EmailService] Error enviando alerta a %s: %v", toEmail, err)
	}
	return err
}

// SendWishlistConfirmationEmail envía un correo al usuario cuando agrega un juego con precio objetivo inferior al actual
func (e *EmailService) SendWishlistConfirmationEmail(
	toEmail, username, gameTitle, gameSlug, storeName string,
	currentPrice, targetPrice float64,
) error {
	gamePageURL := fmt.Sprintf("%s/game/%s", e.frontendURL, gameSlug)
	safeUser := html.EscapeString(username)
	if safeUser == "" {
		safeUser = "Jugador"
	}
	safeTitle := html.EscapeString(gameTitle)
	safeStore := html.EscapeString(storeName)
	safeGamePageURL := html.EscapeString(gamePageURL)

	subject := fmt.Sprintf("💜 Wishlist activa: Monitoreando %s (Objetivo: $%.2f)", gameTitle, targetPrice)

	bodyHTML := fmt.Sprintf(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <div style="max-width:560px;margin:0 auto;background-color:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:20px 24px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">DealHunter — Wishlist Activada</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin-top:0;font-size:15px;color:#cbd5e1;">Hola <strong>%s</strong>,</p>
      <p style="font-size:15px;color:#cbd5e1;line-height:1.6;">
        Has agregado un nuevo videojuego a tu lista de deseos con un precio objetivo inferior al actual. Te enviaremos otra alerta automática en cuanto baje hasta tu meta:
      </p>
      <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:18px;margin:18px 0;">
        <div style="font-size:18px;font-weight:700;color:#ffffff;margin-bottom:8px;">%s</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Mejor precio actual (%s): <strong style="color:#e2e8f0;">$%.2f USD</strong></div>
        <div style="font-size:14px;color:#fbbf24;font-weight:700;">Tu precio objetivo: $%.2f USD</div>
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a href="%s" style="display:inline-block;padding:12px 24px;background-color:#6366f1;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;font-size:14px;">Ver Ficha en DealHunter</a>
      </div>
    </div>
    <div style="padding:14px 24px;background:#0f172a;border-top:1px solid #334155;font-size:11px;color:#64748b;text-align:center;">
      Notificación automática de seguimiento de precios de DealHunter.
    </div>
  </div>
</body>
</html>`, safeUser, safeTitle, safeStore, currentPrice, targetPrice, safeGamePageURL)

	err := e.sendEmail(toEmail, subject, bodyHTML)
	if err != nil {
		log.Printf("[EmailService] Error enviando confirmación de wishlist a %s: %v", toEmail, err)
	}
	return err
}
