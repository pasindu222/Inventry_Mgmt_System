$(document).ready(function() {
    // Initialize chart
    const salesChart = new Chart(
        document.getElementById('salesChart'),
        {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Sales ($)',
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    data: []
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '$' + context.raw.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        }
    );

    // Load dashboard data
    function loadDashboardData() {
        $.get('/api/sales/analytics', function(data) {
            // Update summary cards
            $('#totalRevenue').text('$' + data.summary.total_revenue.toFixed(2));
            $('#totalTransactions').text(data.summary.total_transactions);
            $('#avgSale').text('$' + data.summary.avg_sale.toFixed(2));
            
            // Update sales chart
            salesChart.data.labels = data.daily_sales.map(item => item.day);
            salesChart.data.datasets[0].data = data.daily_sales.map(item => item.amount);
            salesChart.update();
            
            // Update top products
            const topProductsHtml = data.top_products.map(product => `
                <div class="d-flex justify-content-between mb-3">
                    <div>
                        <strong>${product.name}</strong><br>
                        <small class="text-muted">${product.total_quantity} sold</small>
                    </div>
                    <div class="text-end">
                        <strong>$${product.total_revenue.toFixed(2)}</strong>
                    </div>
                </div>
            `).join('');
            $('#topProductsList').html(topProductsHtml);
            
            // Load recent sales
            loadRecentSales();
        });
    }
    
    // Load recent sales
    function loadRecentSales() {
        $.get('/api/sales/recent', function(sales) {
            const tbody = $('#recentSalesTable tbody');
            tbody.empty();
            
            sales.forEach(sale => {
                const row = `
                    <tr>
                        <td>${new Date(sale.date).toLocaleString()}</td>
                        <td>${sale.product_name}</td>
                        <td>${sale.quantity}</td>
                        <td>$${sale.total.toFixed(2)}</td>
                    </tr>
                `;
                tbody.append(row);
            });
        });
    }
    
    // Refresh button
    $('#refreshBtn').click(function() {
        $(this).find('i').addClass('fa-spin');
        loadDashboardData();
        setTimeout(() => {
            $(this).find('i').removeClass('fa-spin');
        }, 1000);
    });
    
    // Initial load
    loadDashboardData();
});