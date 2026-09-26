import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function HistoryChart({ history }) {
  const successfulHistory = history
    .filter(
      (item) =>
        item.outcome === "success" &&
        item.price !== null &&
        item.price !== undefined
    )
    .map((item) => ({
      time: new Date(item.scraped_at).toLocaleString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        }
      ),
      price: Number(item.price)
    }));

  if (successfulHistory.length === 0) {
    return (
      <div className="empty-section">
        No successful price history available yet.
      </div>
    );
  }

  // =========================================
  // SINGLE SUCCESSFUL OBSERVATION
  // =========================================

  if (successfulHistory.length === 1) {
    const point = successfulHistory[0];

    return (
      <div
        className="history-chart"
        style={{
          position: "relative",
          height: "300px",
          padding: "30px"
        }}
      >
        <div
          style={{
            height: "100%",
            borderLeft: "1px solid #9ca3af",
            borderBottom: "1px solid #9ca3af",
            position: "relative"
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center"
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                background: "#2563eb",
                borderRadius: "50%",
                margin: "0 auto 10px"
              }}
            />

            <div
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#111827"
              }}
            >
              ₹{point.price.toLocaleString("en-IN")}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#6b7280",
                marginTop: "4px"
              }}
            >
              {point.time}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#6b7280",
                marginTop: "8px"
              }}
            >
              1 successful observation
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================
  // MULTIPLE SUCCESSFUL OBSERVATIONS
  // =========================================

  return (
    <div className="history-chart">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={successfulHistory}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
          />

          <YAxis
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(value) =>
              `₹${Number(value).toLocaleString("en-IN")}`
            }
          />

          <Tooltip
            formatter={(value) =>
              `₹${Number(value).toLocaleString("en-IN")}`
            }
          />

          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 5 }}
            activeDot={{ r: 7 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default HistoryChart;