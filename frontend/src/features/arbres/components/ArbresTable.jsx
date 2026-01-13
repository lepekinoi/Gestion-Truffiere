import React from 'react';

export default function ArbresTable({
  arbres,
  colonnes,
  config,
  selected,
  onSelect,
  onSelectAllPage,
  isAllPageSelected,
  isSomePageSelected,
  onEdit,
  onDelete,
  interventions,
  onMouseEnter,
  onMouseLeave,
  hasInterventions,
  renderCell
}) {
  return (
    <div style={{ position: 'relative' }}>
      <table>
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={isAllPageSelected}
                ref={el => {
                  if (el) el.indeterminate = isSomePageSelected && !isAllPageSelected;
                }}
                onChange={onSelectAllPage}
                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
              />
            </th>

            {colonnes.map(col => (
              <th key={col} style={{ textAlign: config[col].align || 'left' }}>
                {config[col].label}
              </th>
            ))}

            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {arbres.map(arbre => (
            <tr
              key={arbre.id}
              onMouseEnter={(e) => onMouseEnter(e, arbre.id)}
              onMouseLeave={onMouseLeave}
              style={{
                cursor: hasInterventions(arbre.id) ? 'help' : 'default',
                background: selected.has(arbre.id) ? '#e3f2fd' : 'transparent'
              }}
            >
              <td style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selected.has(arbre.id)}
                  onChange={() => onSelect(arbre.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
              </td>

              {colonnes.map(col => (
                <td key={col} style={{ textAlign: config[col].align || 'left' }}>
                  {renderCell(arbre, col)}
                </td>
              ))}

              <td>
                <button
                  className="btn btn-secondary"
                  onClick={() => onEdit(arbre)}
                  style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                >
                  ✏️
                </button>

                <button
                  className="btn btn-danger"
                  onClick={() => onDelete(arbre)}
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
