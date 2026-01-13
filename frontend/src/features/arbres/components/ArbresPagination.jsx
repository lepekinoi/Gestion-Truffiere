import React from 'react';

export default function ArbresPagination({
  itemsPerPage,
  currentPage,
  totalPages,
  totalItems,
  onChangePage,
  onChangeItemsPerPage,
  getPageNumbers
}) {
  if (itemsPerPage === 'all' || totalPages <= 1) return null;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '0.5rem',
      marginTop: '1.5rem',
      paddingTop: '1rem',
      borderTop: '1px solid #eee'
    }}>
      
      <button onClick={() => onChangePage(1)} disabled={currentPage === 1}>⏮</button>
      <button onClick={() => onChangePage(currentPage - 1)} disabled={currentPage === 1}>◀️</button>

      {getPageNumbers().map((page, idx) => (
        <button
          key={idx}
          onClick={() => page !== '...' && onChangePage(page)}
          disabled={page === '...'}
          style={{
            padding: '0.5rem 0.9rem',
            border: currentPage === page ? '2px solid #2c5f2d' : '1px solid #ddd',
            background: currentPage === page ? '#2c5f2d' : 'white',
            color: currentPage === page ? 'white' : '#333',
            fontWeight: currentPage === page ? 'bold' : 'normal'
          }}
        >
          {page}
        </button>
      ))}

      <button onClick={() => onChangePage(currentPage + 1)} disabled={currentPage === totalPages}>▶️</button>
      <button onClick={() => onChangePage(totalPages)} disabled={currentPage === totalPages}>⏭</button>
    </div>
  );
}
