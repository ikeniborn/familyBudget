-- Products tables for Family Budget application
-- This script creates tables for product management functionality

-- Drop tables if exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS t_l_product_nomenclature CASCADE;
DROP TABLE IF EXISTS t_f_product_price CASCADE;
DROP TABLE IF EXISTS t_d_product CASCADE;

-- Table: t_d_product
-- Description: Master table for products
CREATE TABLE t_d_product (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category_name VARCHAR(100),
    unit_measure VARCHAR(50),
    barcode VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_product_name ON t_d_product(product_name);
CREATE INDEX idx_product_category ON t_d_product(category_name);
CREATE INDEX idx_product_barcode ON t_d_product(barcode);
CREATE INDEX idx_product_active ON t_d_product(is_active);

-- Table: t_f_product_price
-- Description: Historical prices for products by supplier and user
CREATE TABLE t_f_product_price (
    price_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES t_d_product(product_id) ON DELETE CASCADE,
    supplier_name VARCHAR(255),
    price_value DECIMAL(10, 2) NOT NULL CHECK (price_value > 0),
    price_date DATE NOT NULL DEFAULT CURRENT_DATE,
    user_id INTEGER NOT NULL REFERENCES t_d_user(user_id),
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for price queries
CREATE INDEX idx_product_price_product ON t_f_product_price(product_id);
CREATE INDEX idx_product_price_user ON t_f_product_price(user_id);
CREATE INDEX idx_product_price_date ON t_f_product_price(price_date DESC);
CREATE INDEX idx_product_price_supplier ON t_f_product_price(supplier_name);

-- Table: t_l_product_nomenclature
-- Description: Links products to nomenclature categories
CREATE TABLE t_l_product_nomenclature (
    product_id INTEGER NOT NULL REFERENCES t_d_product(product_id) ON DELETE CASCADE,
    nomenclature_id INTEGER NOT NULL REFERENCES t_d_nomenclature(nomenclature_id) ON DELETE CASCADE,
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, nomenclature_id)
);

-- Create indexes for link table
CREATE INDEX idx_product_nomenclature_product ON t_l_product_nomenclature(product_id);
CREATE INDEX idx_product_nomenclature_nom ON t_l_product_nomenclature(nomenclature_id);

-- Function to update updated_dttm on product changes
CREATE OR REPLACE FUNCTION update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_dttm = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamp
CREATE TRIGGER update_product_timestamp_trigger
BEFORE UPDATE ON t_d_product
FOR EACH ROW
EXECUTE FUNCTION update_product_timestamp();

-- Grant permissions to budget user
GRANT SELECT, INSERT, UPDATE, DELETE ON t_d_product TO budget;
GRANT SELECT, INSERT, UPDATE, DELETE ON t_f_product_price TO budget;
GRANT SELECT, INSERT, UPDATE, DELETE ON t_l_product_nomenclature TO budget;
GRANT USAGE, SELECT ON SEQUENCE t_d_product_product_id_seq TO budget;
GRANT USAGE, SELECT ON SEQUENCE t_f_product_price_price_id_seq TO budget;

-- Insert sample data for testing (optional)
/*
INSERT INTO t_d_product (product_name, category_name, unit_measure, barcode, description) VALUES
('Молоко Простоквашино 2.5%', 'Молочные продукты', 'л', '4600605025796', '2.5% жирности, пастеризованное'),
('Хлеб Дарницкий', 'Хлебобулочные изделия', 'шт', '4601234567890', 'Ржано-пшеничный хлеб'),
('Яблоки Голден', 'Фрукты', 'кг', NULL, 'Сорт Голден Делишес'),
('Картофель', 'Овощи', 'кг', NULL, 'Картофель белый'),
('Сахар-песок', 'Бакалея', 'кг', '4600123456789', 'Сахар белый кристаллический');
*/