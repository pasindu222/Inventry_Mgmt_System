from flask import Flask, render_template, request, jsonify
import sqlite3
from flask import abort
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask import redirect, url_for  # Add these to your existing Flask imports

app = Flask(__name__)

app.secret_key = 'P1r2i1m2e@' 

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


# User model
class User(UserMixin):
    def __init__(self, id, username, role):
        self.id = id
        self.username = username
        self.role = role

# Mock database (replace with real DB later)
users = {
    '1': User('1', 'admin', 'admin'),
    '2': User('2', 'cashier', 'cashier')
}

@login_manager.user_loader
def load_user(user_id):
    return users.get(user_id)

@app.route('/')
def home():
    # Redirect to login page if not authenticated
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    # Or redirect to dashboard if logged in
    return redirect(url_for('dashboard'))


# Login route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']  # In real app, hash and verify
        user = next((u for u in users.values() if u.username == username), None)
        if user and password == 'password':  # Replace with real auth
            login_user(user)
            return redirect(url_for('dashboard'))
        return 'Invalid credentials'
    return render_template('login.html')

# Logout route
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

def get_db():
    conn = sqlite3.connect('stationery.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/pos')
@login_required
def pos():
    return render_template('pos.html')
#@app.route('/')
#def pos():
#    return render_template('pos.html')

@app.route('/inventory')
@login_required
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
@login_required
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