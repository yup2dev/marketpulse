const DataTable = ({ data = [], columns = [] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary">
        No data available
      </div>
    );
  }

  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '-';

    switch (format) {
      case 'currency':
        return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percent':
        return `${Number(value).toFixed(2)}%`;
      case 'number':
        return Number(value).toLocaleString();
      case 'date':
        return new Date(value).toLocaleDateString();
      default:
        return value;
    }
  };

  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background-tertiary">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="px-3 py-2 text-left text-text-tertiary font-medium uppercase tracking-wider border-b border-gray-700"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-gray-800 hover:bg-background-tertiary/50 transition-colors"
            >
              {columns.map((col, colIdx) => {
                const value = row[col.key];
                const isPositive = typeof value === 'number' && value > 0;
                const isNegative = typeof value === 'number' && value < 0;

                return (
                  <td
                    key={colIdx}
                    className={`px-3 py-2 ${
                      col.format === 'currency' || col.format === 'percent'
                        ? isPositive
                          ? 'text-positive'
                          : isNegative
                          ? 'text-negative'
                          : 'text-text-primary'
                        : 'text-text-primary'
                    }`}
                  >
                    {formatValue(value, col.format)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
