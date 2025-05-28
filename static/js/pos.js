$(document).ready(function() {
    let cart = [];
    
    // Load available products
    function loadProducts() {
        return $.get('/api/products');
    }
    
    // Add product to cart
    function addToCart(product, quantity = 1) {
        const existingItem = cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.total = existingItem.quantity * existingItem.price;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: quantity,
                total: product.price * quantity
            });
        }
        
        updateCartDisplay();
    }
    
    // Update cart display
    function updateCartDisplay() {
        const tbody = $('#cartBody');
        tbody.empty();
        
        let grandTotal = 0;
        
        cart.forEach(item => {
            grandTotal += item.total;
            
            const row = `
                <tr data-id="${item.id}">
                    <td>${item.name}</td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td>
                        <div class="input-group">
                            <button class="btn btn-sm btn-outline-secondary decrement">-</button>
                            <input type="number" class="form-control form-control-sm text-center quantity" 
                                   value="${item.quantity}" min="1" style="width: 50px;">
                            <button class="btn btn-sm btn-outline-secondary increment">+</button>
                        </div>
                    </td>
                    <td>$${item.total.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-sm btn-danger remove-item">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                </tr>
            `;
            
            tbody.append(row);
        });
        
        $('#totalAmount').text(grandTotal.toFixed(2));
        
        // Attach event handlers to new elements
        $('.decrement').click(function() {
            const id = $(this).closest('tr').data('id');
            const item = cart.find(item => item.id === id);
            if (item.quantity > 1) {
                item.quantity--;
                item.total = item.quantity * item.price;
                updateCartDisplay();
            }
        });
        
        $('.increment').click(function() {
            const id = $(this).closest('tr').data('id');
            const item = cart.find(item => item.id === id);
            item.quantity++;
            item.total = item.quantity * item.price;
            updateCartDisplay();
        });
        
        $('.quantity').change(function() {
            const id = $(this).closest('tr').data('id');
            const item = cart.find(item => item.id === id);
            const newQty = parseInt($(this).val()) || 1;
            item.quantity = newQty;
            item.total = item.quantity * item.price;
            updateCartDisplay();
        });
        
        $('.remove-item').click(function() {
            const id = $(this).closest('tr').data('id');
            cart = cart.filter(item => item.id !== id);
            updateCartDisplay();
        });
    }
    
    // Barcode scanning
    let searchTimeout;

        $('#barcodeInput').on('input', function() {
            const query = $(this).val().trim();
            clearTimeout(searchTimeout);
            
            if (query.length >= 2) { // Start searching after 2 characters
                searchTimeout = setTimeout(() => {
                    searchProducts(query).then(products => {
                        if (products.length === 1) {
                            // Auto-select if only one match
                            addToCart(products[0]);
                            $(this).val('').focus();
                        } else if (products.length > 1) {
                            showProductSelectionModal(products);
                        }
                    });
                }, 300); // 300ms debounce
            }
        });

        function searchProducts(query) {
            return new Promise((resolve) => {
                $.get(`/api/products/search?q=${encodeURIComponent(query)}`, function(products) {
                    resolve(products);
                }).fail(() => resolve([]));
            });
        }

        function showProductSelectionModal(products) {
            const modal = $(`
                <div class="modal fade" id="productSelectionModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Select Product</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="list-group">
                                    ${products.map(product => `
                                        <button type="button" class="list-group-item list-group-item-action product-select" 
                                                data-id="${product.id}">
                                            <div class="d-flex w-100 justify-content-between">
                                                <h6 class="mb-1">${product.name}</h6>
                                                <small>$${product.price.toFixed(2)}</small>
                                            </div>
                                            <small class="text-muted">Stock: ${product.stock} | Barcode: ${product.barcode || 'N/A'}</small>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            
            modal.appendTo('body').modal('show');
            
            modal.on('click', '.product-select', function() {
                const productId = $(this).data('id');
                const product = products.find(p => p.id === productId);
                addToCart(product);
                modal.modal('hide').remove();
                $('#barcodeInput').val('').focus();
            });
            
            modal.on('hidden.bs.modal', function() {
                modal.remove();
                $('#barcodeInput').focus();
            });
        }

    
    // Manual entry
    $('#manualAddBtn').click(function() {
        const barcode = prompt("Enter product ID or barcode:");
        if (barcode) {
            $('#barcodeInput').val(barcode).trigger('change');
        }
    });
    
    // Add product modal
    $('#addProductBtn').click(function() {
        $('#addProductModal').modal('show');
    });
    
    // Save new product
    $('#saveProductBtn').click(function() {
        const formData = {
            name: $('input[name="name"]').val(),
            price: parseFloat($('input[name="price"]').val()),
            stock: parseInt($('input[name="stock"]').val()),
            barcode: $('input[name="barcode"]').val()
        };
        
        $.ajax({
            url: '/api/products',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                if (response.success) {
                    $('#addProductModal').modal('hide');
                    $('#productForm')[0].reset();
                    alert('Product added successfully!');
                } else {
                    alert('Error: ' + response.error);
                }
            },
            error: function() {
                alert('Failed to add product');
            }
        });
    });
    
    // Clear cart
    $('#clearCartBtn').click(function() {
        if (cart.length > 0 && confirm('Clear all items from cart?')) {
            cart = [];
            updateCartDisplay();
        }
    });
    
    // Checkout
    $('#checkoutBtn').click(function() {
        if (cart.length === 0) {
            alert('Cart is empty!');
            return;
        }
        
        if (confirm(`Confirm sale for $${$('#totalAmount').text()}?`)) {
            $.ajax({
                url: '/api/sales',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ items: cart }),
                success: function(response) {
                    if (response.success) {
                        alert('Sale completed successfully!');
                        cart = [];
                        updateCartDisplay();
                    } else {
                        alert('Error: ' + response.error);
                    }
                },
                error: function() {
                    alert('Failed to process sale');
                }
            });
        }
    });
    
    // Print receipt
    $('#printBtn').click(function() {
        if (cart.length === 0) {
            alert('Cart is empty!');
            return;
        }
        
        const receiptWindow = window.open('', '_blank');
        const receiptContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt</title>
                <style>
                    body { font-family: Arial, sans-serif; width: 80mm; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 10px; }
                    .receipt-table { width: 100%; border-collapse: collapse; }
                    .receipt-table th, .receipt-table td { padding: 5px; border-bottom: 1px dashed #ccc; }
                    .total-row { font-weight: bold; }
                    .footer { margin-top: 10px; text-align: center; font-size: 0.8em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Stationery Shop</h2>
                    <p>${new Date().toLocaleString()}</p>
                </div>
                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cart.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>$${item.price.toFixed(2)}</td>
                                <td>$${item.total.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td colspan="3">Total:</td>
                            <td>$${$('#totalAmount').text()}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">
                    <p>Thank you for your purchase!</p>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 1000);
                    };
                </script>
            </body>
            </html>
        `;
        
        receiptWindow.document.write(receiptContent);
        receiptWindow.document.close();
    });
});