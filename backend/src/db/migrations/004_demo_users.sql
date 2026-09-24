-- ============================================================
-- Migration 004 : Cuentas Demo y datos de prueba
-- ============================================================

-- 1. Crear o actualizar Cliente Demo (password: demo123)
INSERT INTO users (nombre, email, password_hash, nit, salario_bruto, rol, tipo_contribuyente, regimen)
VALUES (
    'Juan Mamani (Cliente Demo)',
    'cliente@demo.bo',
    '$2a$10$p//Cl3FYstiyWjler49bj.0aS9StSfl88uPZKFuLG94K4B.syotGG',
    '1023456789',
    6500.00,
    'particular',
    'dependiente',
    'general'
)
ON CONFLICT (email) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    password_hash = '$2a$10$p//Cl3FYstiyWjler49bj.0aS9StSfl88uPZKFuLG94K4B.syotGG',
    rol = 'particular',
    salario_bruto = 6500.00,
    nit = '1023456789';

-- 2. Crear o actualizar Contador Demo (password: demo123)
INSERT INTO users (nombre, email, password_hash, nit, rol, tipo_contribuyente, regimen)
VALUES (
    'Lic. Roberto Pérez (Contador Demo)',
    'contador@demo.bo',
    '$2a$10$p//Cl3FYstiyWjler49bj.0aS9StSfl88uPZKFuLG94K4B.syotGG',
    '4567890123',
    'contador',
    'independiente',
    'general'
)
ON CONFLICT (email) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    password_hash = '$2a$10$p//Cl3FYstiyWjler49bj.0aS9StSfl88uPZKFuLG94K4B.syotGG',
    rol = 'contador';

-- 3. Restablecer contraseñas de todos los usuarios existentes a 'demo123'
UPDATE users
SET password_hash = '$2a$10$p//Cl3FYstiyWjler49bj.0aS9StSfl88uPZKFuLG94K4B.syotGG';

-- 4. Vincular Contador con Cliente Demo (y con todos los particulares existentes)
INSERT INTO memberships (contador_user_id, cliente_user_id, estado, permisos)
SELECT c.id, u.id, 'activo', '{"ver":true,"editar":true}'::jsonb
FROM users c, users u
WHERE c.email = 'contador@demo.bo' AND u.rol = 'particular'
ON CONFLICT (contador_user_id, cliente_user_id) DO UPDATE SET estado = 'activo';

-- 5. Crear periodo y facturas de demostración para el mes actual
DO $$
DECLARE
    v_cliente_id INT;
    v_periodo_id INT;
    v_anio INT := EXTRACT(YEAR FROM CURRENT_DATE);
    v_mes INT := EXTRACT(MONTH FROM CURRENT_DATE);
BEGIN
    SELECT id INTO v_cliente_id FROM users WHERE email = 'cliente@demo.bo';
    
    IF v_cliente_id IS NOT NULL THEN
        -- Insertar o recuperar periodo actual
        INSERT INTO periodos (user_id, anio, mes, salario_mes, estado)
        VALUES (v_cliente_id, v_anio, v_mes, 6500.00, 'abierto')
        ON CONFLICT (user_id, anio, mes) DO UPDATE SET salario_mes = 6500.00
        RETURNING id INTO v_periodo_id;

        IF v_periodo_id IS NULL THEN
            SELECT id INTO v_periodo_id FROM periodos WHERE user_id = v_cliente_id AND anio = v_anio AND mes = v_mes;
        END IF;

        -- Insertar facturas de prueba si no hay ninguna en este periodo
        IF NOT EXISTS (SELECT 1 FROM facturas WHERE periodo_id = v_periodo_id) THEN
            INSERT INTO facturas (user_id, periodo_id, nit_proveedor, nro_factura, fecha, importe, codigo_autorizacion, validado, fuente_validacion)
            VALUES 
                (v_cliente_id, v_periodo_id, '1020304050', '1045', CURRENT_DATE - INTERVAL '6 days', 350.00, 'A1B2C3D4', true, 'qr'),
                (v_cliente_id, v_periodo_id, '2030405060', '8921', CURRENT_DATE - INTERVAL '3 days', 820.50, 'E5F6G7H8', true, 'qr'),
                (v_cliente_id, v_periodo_id, '3040506070', '3412', CURRENT_DATE - INTERVAL '1 day', 410.00, 'I9J0K1L2', false, 'manual');
        END IF;
    END IF;
END $$;
