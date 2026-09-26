import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

function HistoryChart({ history = [] }) {

  const data = history
    .filter(
      (item) =>
        item.outcome === "success" &&
        item.price !== null &&
        item.price !== undefined
    )
    .map((item) => ({
      time: new Date(item.scraped_at).getTime(),
      label: new Date(
        item.scraped_at
      ).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }),
      price: Number(item.price)
    }))
    .sort((a, b) => a.time - b.time);

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        <span>No successful price observations yet</span>
      </div>
    );
  }

  const formatPrice = (value) =>
    `₹${Number(value).toLocaleString("en-IN")}`;

  const minPrice = Math.min(
    ...data.map((item) => item.price)
  );

  const maxPrice = Math.max(
    ...data.map((item) => item.price)
  );

  const padding =
    minPrice === maxPrice
      ? Math.max(minPrice * 0.08, 100)
      : (maxPrice - minPrice) * 0.15;

  return (
    <div className="history-chart">

      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <LineChart
          data={data}
          margin={{
            top: 8,
            right: 10,
            left: 4,
            bottom: 5
          }}
        >

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#edf0f4"
          />

          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "short"
                }
              )
            }
            tick={{
              fontSize: 9,
              fill: "#8994a5"
            }}
            axisLine={false}
            tickLine={false}
            minTickGap={25}
          />

          <YAxis
            domain={[
              Math.max(0, minPrice - padding),
              maxPrice + padding
            ]}
            tickFormatter={(value) =>
              `₹${Math.round(
                value / 1000
              )}k`
            }
            tick={{
              fontSize: 9,
              fill: "#8994a5"
            }}
            axisLine={false}
            tickLine={false}
            width={42}
          />

          <Tooltip
            contentStyle={{
              border: "1px solid #e1e6ee",
              borderRadius: "8px",
              background: "#ffffff",
              boxShadow:
                "0 6px 20px rgba(20,32,51,0.08)",
              fontSize: "11px"
            }}
            labelFormatter={(value) =>
              new Date(value).toLocaleString(
                "en-IN"
              )
            }
            formatter={(value) => [
              formatPrice(value),
              "Price"
            ]}
          />

          <Line
            type="monotone"
            dataKey="price"
            stroke="#2463d8"
            strokeWidth={2.2}
            dot={{
              r: 3.5,
              fill: "#2463d8",
              stroke: "#ffffff",
              strokeWidth: 2
            }}
            activeDot={{
              r: 5
            }}
            isAnimationActive={false}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  );
}

export default HistoryChart;