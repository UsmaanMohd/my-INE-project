const supabase = require("../config/supabase");

// ============================================
// EXPORT SCRAPE HISTORY AS CSV
// GET /api/products/:id/export
// ============================================

async function exportProductHistory(req, res) {
  try {
    const { id } = req.params;

    // --------------------------------------------
    // GET TRACKED PRODUCT
    // --------------------------------------------

    const {
      data: product,
      error: productError
    } = await supabase
      .from("tracked_products")
      .select("*")
      .eq("id", id)
      .single();

    if (productError || !product) {
      return res.status(404).json({
        success: false,
        message: "Tracked product not found"
      });
    }

    // --------------------------------------------
    // GET SCRAPE HISTORY
    // --------------------------------------------

    const {
      data: history,
      error: historyError
    } = await supabase
      .from("scrape_history")
      .select(
        "scraped_at, price, stock, outcome"
      )
      .eq("tracked_product_id", id)
      .order("scraped_at", {
        ascending: true
      });

    if (historyError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch scrape history",
        error: historyError.message
      });
    }

    // --------------------------------------------
    // CSV HEADER
    // --------------------------------------------

    const headers = [
      "store product ID",
      "product name",
      "selected option",
      "timestamp",
      "price",
      "stock",
      "outcome"
    ];

    // --------------------------------------------
    // CSV ESCAPE FUNCTION
    // --------------------------------------------

    function escapeCSV(value) {
      if (
        value === null ||
        value === undefined
      ) {
        return "";
      }

      const stringValue = String(value);

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(
          /"/g,
          '""'
        )}"`;
      }

      return stringValue;
    }

    // --------------------------------------------
    // BUILD CSV ROWS
    // --------------------------------------------

    const rows = history.map((record) => {
      const timestamp = record.scraped_at
        ? new Date(record.scraped_at).toISOString()
        : "";

      return [
        product.store_product_id,
        product.product_name,
        product.selected_option,
        timestamp,
        record.price ?? "",
        record.stock ?? "",
        record.outcome ?? ""
      ]
        .map(escapeCSV)
        .join(",");
    });

    // --------------------------------------------
    // FINAL CSV
    // --------------------------------------------

    const csv = [
      headers.join(","),
      ...rows
    ].join("\n");

    // --------------------------------------------
    // DOWNLOAD RESPONSE
    // --------------------------------------------

    const filename =
      `product-${product.store_product_id}-history.csv`;

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.status(200).send(csv);

  } catch (error) {
    console.error(
      "CSV export error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

module.exports = {
  exportProductHistory
};