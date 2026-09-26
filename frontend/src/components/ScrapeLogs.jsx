function ScrapeLogs({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="empty-section">
        No scrape logs available yet.
      </div>
    );
  }

  return (
    <div className="logs-container">
      <table className="logs-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Attempt</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Outcome</th>
            <th>Error</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>
                {new Date(
                  log.scraped_at
                ).toLocaleString("en-IN")}
              </td>

              <td>
                {log.attempt_number}
              </td>

              <td>
                {log.price !== null
                  ? `₹${Number(
                      log.price
                    ).toLocaleString("en-IN")}`
                  : "-"}
              </td>

              <td>
                {log.stock || "-"}
              </td>

              <td>
                <span
                  className={`outcome ${log.outcome}`}
                >
                  {log.outcome}
                </span>
              </td>

              <td className="error-cell">
                {log.error_message || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScrapeLogs;