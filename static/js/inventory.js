$(document).ready(function() {
    // Load products when page loads
    loadProducts();
    
    // Search functionality
    let searchTimeout;
        
        // Search functionality - updated version
        $('#searchInput').on('input', function() {
            clearTimeout(searchTimeout);
            const query = $(this).val().trim();
            
            searchTimeout = setTimeout(() => {
                if (query.length >= 1) { // Search even with 1 character
                    performSearch(query);
                } else {
                    loadProducts(); // Show all when empty
                }
            }, 300); // 300ms debounce
        });
        
        // Perform the search
        function performSearch(query) {
            showLoading(true);
            
            $.ajax({
                url: '/api/products/search',
                method: 'GET',
                data: { q: query },
                success: function(products) {
                    renderProducts(products);
                },
                error: function() {
                    showAlert('Failed to load search results', 'danger');
                },
                complete: function() {
                    showLoading(false);
                }
            });
        }
        
        // Show loading state
        function showLoading(loading) {
            const searchBtn = $('#searchBtn');
            if (loading) {
                searchBtn.html('<i class="fas fa-spinner fa-spin"></i>');
                $('#inventoryTable tbody').html('<tr><td colspan="6" class="text-center">Searching...</td></tr>');
            } else {
                searchBtn.html('<i class="fas fa-search"></i>');
            }
        }
    
    // Add product
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
                    $('#addProductForm')[0].reset();
                    loadProducts();
                    showAlert('Product added successfully!', 'success');
                } else {
                    showAlert('Error: ' + response.error, 'danger');
                }
            },
            error: function() {
                showAlert('Failed to add product', 'danger');
            }
        });
    });
    
    // Update product
    $('#updateProductBtn').click(function() {
        const productId = $('#editProductId').val();
        const formData = {
            name: $('#editProductName').val(),
            price: parseFloat($('#editProductPrice').val()),
            stock: parseInt($('#editProductStock').val()),
            barcode: $('#editProductBarcode').val()
        };
        
        $.ajax({
            url: `/api/products/${productId}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                if (response.success) {
                    $('#editProductModal').modal('hide');
                    loadProducts();
                    showAlert('Product updated successfully!', 'success');
                } else {
                    showAlert('Error: ' + response.error, 'danger');
                }
            },
            error: function() {
                showAlert('Failed to update product', 'danger');
            }
        });
    });
    
    // Load all products
    function loadProducts() {
        $.get('/api/products', function(products) {
            renderProducts(products);
        }).fail(function() {
            showAlert('Failed to load products', 'danger');
        });
    }
    
    // Search products
    function searchProducts() {
        const query = $('#searchInput').val().trim();
        if (query) {
            $.get(`/api/products?search=${query}`, function(products) {
                renderProducts(products);
            }).fail(function() {
                showAlert('Failed to search products', 'danger');
            });
        } else {
            loadProducts();
        }
    }
    
    // Render products in table
    function renderProducts(products) {
        const tbody = $('#inventoryTable tbody');
        tbody.empty();
        
        products.forEach(product => {
            const row = `
                <tr data-id="${product.id}">
                    <td>${product.id}</td>
                    <td>${product.name}</td>
                    <td>$${product.price.toFixed(2)}</td>
                    <td class="${getStockClass(product.stock)}">${product.stock}</td>
                    <td>${product.barcode || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-btn">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
        
        // Attach event handlers
        $('.edit-btn').click(showEditModal);
        $('.delete-btn').click(deleteProduct);
    }
    
    // Show edit modal
    function showEditModal() {
        const productId = $(this).closest('tr').data('id');
        
        $.get(`/api/products/${productId}`, function(product) {
            $('#editProductId').val(product.id);
            $('#editProductName').val(product.name);
            $('#editProductPrice').val(product.price);
            $('#editProductStock').val(product.stock);
            $('#editProductBarcode').val(product.barcode || '');
            $('#editProductModal').modal('show');
        }).fail(function() {
            showAlert('Failed to load product details', 'danger');
        });
    }
    
    // Delete product
    function deleteProduct() {
        const productId = $(this).closest('tr').data('id');
        
        if (confirm('Are you sure you want to delete this product?')) {
            $.ajax({
                url: `/api/products/${productId}`,
                method: 'DELETE',
                success: function(response) {
                    if (response.success) {
                        loadProducts();
                        showAlert('Product deleted successfully!', 'success');
                    } else {
                        showAlert('Error: ' + response.error, 'danger');
                    }
                },
                error: function() {
                    showAlert('Failed to delete product', 'danger');
                }
            });
        }
    }
    
    // Get stock level class
    function getStockClass(stock) {
        if (stock <= 0) return 'text-danger fw-bold';
        if (stock <= 10) return 'text-warning';
        return '';
    }
    
    // Show alert message
    function showAlert(message, type) {
        const alert = $(`
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);
        
        $('.container').prepend(alert);
        setTimeout(() => alert.alert('close'), 5000);
    }
});