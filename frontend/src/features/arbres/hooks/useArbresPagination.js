import { useState, useMemo } from 'react';

const PAGINATION_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 'all', label: 'Tous' }
];

export default function useArbresPagination(filteredArbres) {
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = filteredArbres.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);

  const paginatedArbres = useMemo(() => {
    if (itemsPerPage === 'all') return filteredArbres;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredArbres.slice(start, start + itemsPerPage);
  }, [filteredArbres, itemsPerPage, currentPage]);

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return {
    paginatedArbres,
    itemsPerPage,
    currentPage,
    totalPages,
    totalItems,
    handleItemsPerPageChange,
    setCurrentPage,
    getPageNumbers,
    PAGINATION_OPTIONS
  };
}
