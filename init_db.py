import sqlite3

def init_db():
    conn = sqlite3.connect('stationery.db')
    cursor = conn.cursor()
    
    # Drop existing tables
    cursor.execute("DROP TABLE IF EXISTS products")
    cursor.execute("DROP TABLE IF EXISTS sales")
    
    # Create tables
    cursor.execute('''
    CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        barcode TEXT UNIQUE
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        total REAL NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
    ''')
    
    # Add sample data
    sample_products = [
        ('Notebook', 2.50, 100, '123456'),
        ('Pen', 1.20, 200, '789012'),
        ('Pencil', 0.80, 150, '345678')
    ]
    
    cursor.executemany(
        "INSERT INTO products (name, price, stock, barcode) VALUES (?, ?, ?, ?)",
        sample_products
    )
    
    conn.commit()
    conn.close()
    print("Database initialized with sample data!")

if __name__ == '__main__':
    init_db()