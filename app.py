from flask import Flask, render_template, request, jsonify
import sqlite3
from flask import abort

app = Flask(__name__)

def get_db():
    conn = sqlite3.connect('stationery.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def pos():
    return render_template('pos.html')

@app.route('/inventory')
def inventory():
    return render_template('inventory.html')

# API Endpoints
@app.route('/api/products', methods=['GET'])
def get_products():
    conn = get_db()
    try:
        products = conn.execute('SELECT * FROM products').fetchall()
        return jsonify([dict(product) for product in products])
    finally:
        conn.close()

@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.get_json()
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO products (name, price, stock, barcode) VALUES (?, ?, ?, ?)",
            (data['name'], data['price'], data['stock'], data.get('barcode'))
        )
        conn.commit()
        return jsonify({'success': True, 'id': cursor.lastrowid})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Barcode must be unique'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    data = request.get_json()
    conn = get_db()
    try:
        conn.execute(
            "UPDATE products SET name=?, price=?, stock=?, barcode=? WHERE id=?",
            (data['name'], data['price'], data['stock'], data.get('barcode'), product_id)
        )
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/sales', methods=['POST'])
def create_sale():
    data = request.get_json()
    conn = get_db()
    try:
        cursor = conn.cursor()
        # Process each item in the sale
        for item in data['items']:
            cursor.execute(
                "INSERT INTO sales (product_id, quantity, total) VALUES (?, ?, ?)",
                (item['id'], item['quantity'], item['total'])
            )
            # Update inventory
            cursor.execute(
                "UPDATE products SET stock = stock - ? WHERE id = ?",
                (item['quantity'], item['id'])
            )
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    conn = get_db()
    try:
        product = conn.execute(
            'SELECT * FROM products WHERE id = ?',
            (product_id,)
        ).fetchone()
        
        if product is None:
            abort(404, description="Product not found")
            
        return jsonify(dict(product))
    finally:
        conn.close()

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    conn = get_db()
    try:
        conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/products/search')
def search_products():
    query = request.args.get('q', '').strip().lower()
    conn = get_db()
    try:
        if query:
            # Search by name starting with, barcode, or ID
            products = conn.execute('''
                SELECT * FROM products 
                WHERE LOWER(name) LIKE ? 
                   OR barcode LIKE ? 
                   OR id = ?
                ORDER BY 
                    CASE 
                        WHEN LOWER(name) LIKE ? THEN 1 
                        WHEN barcode LIKE ? THEN 2 
                        ELSE 3 
                    END
            ''', (
                f'{query}%',
                f'{query}%',
                query if query.isdigit() else -1,
                f'{query}%',
                f'{query}%'
            )).fetchall()
        else:
            products = conn.execute('SELECT * FROM products').fetchall()
            
        return jsonify([dict(product) for product in products])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# Add to your existing app.py
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/api/sales/analytics')
def sales_analytics():
    conn = get_db()
    try:
        # Daily sales data
        daily_sales = conn.execute('''
            SELECT date(date) as day, SUM(total) as amount 
            FROM sales 
            GROUP BY day 
            ORDER BY day DESC 
            LIMIT 30
        ''').fetchall()
        
        # Top products
        top_products = conn.execute('''
            SELECT p.name, SUM(s.quantity) as total_quantity, SUM(s.total) as total_revenue
            FROM sales s
            JOIN products p ON s.product_id = p.id
            GROUP BY p.name
            ORDER BY total_revenue DESC
            LIMIT 5
        ''').fetchall()
        
        # Sales summary
        summary = conn.execute('''
            SELECT 
                COUNT(*) as total_transactions,
                SUM(total) as total_revenue,
                AVG(total) as avg_sale,
                MAX(date) as last_sale_date
            FROM sales
        ''').fetchone()
        
        return jsonify({
            'daily_sales': [dict(row) for row in daily_sales],
            'top_products': [dict(row) for row in top_products],
            'summary': dict(summary)
        })
    finally:
        conn.close()

@app.route('/api/sales/recent')
def recent_sales():
    conn = get_db()
    try:
        sales = conn.execute('''
            SELECT s.date, p.name as product_name, s.quantity, s.total
            FROM sales s
            JOIN products p ON s.product_id = p.id
            ORDER BY s.date DESC
            LIMIT 10
        ''').fetchall()
        return jsonify([dict(row) for row in sales])
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)