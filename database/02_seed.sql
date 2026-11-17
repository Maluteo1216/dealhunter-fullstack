-- ============================================================================
-- 02_seed.sql
-- Datos Iniciales Semilla: Tiendas Oficiales, Géneros y Registros Base
-- ============================================================================

-- Tiendas oficiales soportadas por CheapShark API
INSERT INTO stores (external_store_id, name, slug, base_url, logo_url, is_active) VALUES
('1', 'Steam', 'steam', 'https://store.steampowered.com', 'https://www.cheapshark.com/img/stores/logos/0.png', true),
('2', 'GamersGate', 'gamersgate', 'https://www.gamersgate.com', 'https://www.cheapshark.com/img/stores/logos/1.png', true),
('3', 'GreenManGaming', 'greenmangaming', 'https://www.greenmangaming.com', 'https://www.cheapshark.com/img/stores/logos/2.png', true),
('7', 'GOG', 'gog', 'https://www.gog.com', 'https://www.cheapshark.com/img/stores/logos/6.png', true),
('8', 'EA App', 'ea-app', 'https://www.ea.com', 'https://www.cheapshark.com/img/stores/logos/7.png', true),
('11', 'Humble Store', 'humble-store', 'https://www.humblebundle.com/store', 'https://www.cheapshark.com/img/stores/logos/10.png', true),
('13', 'Ubisoft Connect', 'ubisoft-connect', 'https://store.ubisoft.com', 'https://www.cheapshark.com/img/stores/logos/12.png', true),
('15', 'Fanatical', 'fanatical', 'https://www.fanatical.com', 'https://www.cheapshark.com/img/stores/logos/14.png', true),
('25', 'Epic Games Store', 'epic-games-store', 'https://store.epicgames.com', 'https://www.cheapshark.com/img/stores/logos/24.png', true)
ON CONFLICT (external_store_id) DO UPDATE SET 
    name = EXCLUDED.name,
    base_url = EXCLUDED.base_url,
    logo_url = EXCLUDED.logo_url,
    is_active = EXCLUDED.is_active;

-- Géneros comunes
INSERT INTO genres (name, slug) VALUES
('Action', 'action'),
('RPG', 'rpg'),
('Indie', 'indie'),
('Strategy', 'strategy'),
('Adventure', 'adventure'),
('Shooter', 'shooter'),
('Simulation', 'simulation'),
('Horror', 'horror'),
('Sports', 'sports'),
('Open World', 'open-world')
ON CONFLICT (slug) DO NOTHING;

-- Publishers reconocidos
INSERT INTO publishers (name, slug) VALUES
('Valve', 'valve'),
('CD PROJEKT RED', 'cd-projekt-red'),
('FromSoftware', 'fromsoftware'),
('Capcom', 'capcom'),
('Bethesda Softworks', 'bethesda-softworks'),
('Ubisoft', 'ubisoft'),
('Electronic Arts', 'electronic-arts')
ON CONFLICT (slug) DO NOTHING;
