package services

import (
	"fmt"
	"html"
	"log"
	"net/smtp"
	"strings"
)

// EmailService gestiona el envío de correos electrónicos de alertas mediante SMTP (ej. Gmail App Password)
type EmailService struct {
	host        string
	port        string
	user        string
	pass        string
	from        string
	frontendURL string
}

func NewEmailService(host, port, user, pass, from, frontendURL string) *EmailService {
	return &EmailService{
		host:        strings.TrimSpace(host),
		port:        strings.TrimSpace(port),
		user:        strings.TrimSpace(user),
		pass:        strings.ReplaceAll(strings.TrimSpace(pass), " ", ""),
		from:        strings.TrimSpace(from),
		frontendURL: strings.TrimRight(strings.TrimSpace(frontendURL), "/"),
	}
}

// IsConfigured indica si las credenciales SMTP están presentes para enviar correos reales
func (e *EmailService) IsConfigured() bool {
	return e != nil && e.host != "" && e.port != "" && e.user != "" && e.pass != ""
}

// SendPriceAlertEmail envía un correo HTML al usuario cuando un juego de su wishlist alcanza el precio objetivo
func (e *EmailService) SendPriceAlertEmail(
	toEmail, username, gameTitle, gameSlug, storeName string,
	triggeredPrice, targetPrice, discountPct float64,
	productURL string,
) error {
	if !e.IsConfigured() {
		log.Printf("[EmailService] SMTP no configurado; alerta guardada solo en base de datos para %s (%s)", toEmail, gameTitle)
		return fmt.Errorf("SMTP no configurado")
	}

	if strings.TrimSpace(toEmail) == "" {
		return fmt.Errorf("destinatario vacío")
	}

	fromHeader := e.from
	if fromHeader == "" {
		fromHeader = fmt.Sprintf("DealHunter <%s>", e.user)
	}

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
          <a href="%s" style="color:#94a3b8;font-size:12px;text-decoration:underline;">Ver historial de precios en DealHunter</a>
        </div>
      </div>
    </div>
    <div style="padding:14px 24px;background:#0f172a;border-top:1px solid #334155;font-size:11px;color:#64748b;text-align:center;">
      Recibiste este correo porque configuraste una alerta de precio en tu cuenta de DealHunter.
    </div>
  </div>
</body>
</html>`, safeUser, safeTitle, safeStore, triggeredPrice, discountBadge, targetPrice, safeBuyURL, safeStore, safeGamePageURL)

	headers := []string{
		fmt.Sprintf("From: %s", fromHeader),
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=\"UTF-8\"",
	}
	msg := []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + bodyHTML)

	addr := fmt.Sprintf("%s:%s", e.host, e.port)
	auth := smtp.PlainAuth("", e.user, e.pass, e.host)

	if err := smtp.SendMail(addr, auth, e.user, []string{toEmail}, msg); err != nil {
		log.Printf("[EmailService] Error enviando correo a %s: %v", toEmail, err)
		return err
	}

	log.Printf("[EmailService] Correo de alerta enviado exitosamente a %s (%s - $%.2f en %s)", toEmail, gameTitle, triggeredPrice, storeName)
	return nil
}

// SendWishlistConfirmationEmail envía un correo de confirmación/prueba al agregar un juego a la wishlist
// cuando el precio actual aún está por encima del precio objetivo configurado.
func (e *EmailService) SendWishlistConfirmationEmail(
	toEmail, username, gameTitle, gameSlug, storeName string,
	currentPrice, targetPrice float64,
) error {
	if !e.IsConfigured() {
		log.Printf("[EmailService] SMTP no configurado; confirmación de wishlist omitida para %s (%s)", toEmail, gameTitle)
		return fmt.Errorf("SMTP no configurado")
	}

	if strings.TrimSpace(toEmail) == "" {
		return fmt.Errorf("destinatario vacío")
	}

	fromHeader := e.from
	if fromHeader == "" {
		fromHeader = fmt.Sprintf("DealHunter <%s>", e.user)
	}

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
        Has agregado un nuevo videojuego a tu lista de deseos. Te enviaremos otra alerta automática en cuanto baje hasta tu precio objetivo:
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

	headers := []string{
		fmt.Sprintf("From: %s", fromHeader),
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=\"UTF-8\"",
	}
	msg := []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + bodyHTML)

	addr := fmt.Sprintf("%s:%s", e.host, e.port)
	auth := smtp.PlainAuth("", e.user, e.pass, e.host)

	if err := smtp.SendMail(addr, auth, e.user, []string{toEmail}, msg); err != nil {
		log.Printf("[EmailService] Error enviando confirmación de wishlist a %s: %v", toEmail, err)
		return err
	}

	log.Printf("[EmailService] Correo de confirmación de wishlist enviado a %s (%s - objetivo $%.2f)", toEmail, gameTitle, targetPrice)
	return nil
}
