const supabase = require("../config/supabase");
const { scrapeAndSave } = require("../services/scrapeService");

// ============================================
// GET ALL TRACKED PRODUCTS
// ============================================

async function getTrackedProducts(req, res) {
  try {
    const { data, error } = await supabase
      .from("tracked_products")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch tracked products",
        error: error.message
      });
    }

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}


// ============================================
// GET SINGLE TRACKED PRODUCT
// ============================================

async function getTrackedProduct(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("tracked_products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: "Tracked product not found",
        error: error.message
      });
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}


// ============================================
// ADD TRACKED PRODUCT
// ============================================

async function addTrackedProduct(req, res) {
  try {
    const {
      store_product_id,
      product_name,
      selected_option,
      product_url
    } = req.body;

    if (
      !store_product_id ||
      !product_name ||
      !selected_option ||
      !product_url
    ) {
      return res.status(400).json({
        success: false,
        message:
          "store_product_id, product_name, selected_option and product_url are required"
      });
    }

    const { data, error } = await supabase
      .from("tracked_products")
      .insert({
        store_product_id,
        product_name,
        selected_option,
        product_url
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Failed to add tracked product",
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: "Product added for tracking",
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}


// ============================================
// GET PRICE HISTORY
// ============================================

async function getPriceHistory(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("scrape_history")
      .select(
        "id, tracked_product_id, scraped_at, price, stock, outcome, error_message"
      )
      .eq("tracked_product_id", id)
      .order("scraped_at", {
        ascending: true
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch price history",
        error: error.message
      });
    }

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}


// ============================================
// GET LATEST SUCCESSFUL PRICE
// ============================================

async function getLatestPrice(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("scrape_history")
      .select(
        "id, tracked_product_id, scraped_at, price, stock, outcome"
      )
      .eq("tracked_product_id", id)
      .eq("outcome", "success")
      .order("scraped_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch latest price",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "No successful scrape found for this product"
      });
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}


// ============================================
// GET SCRAPE LOGS
// ============================================

async function getScrapeLogs(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("scrape_history")
      .select("*")
      .eq("tracked_product_id", id)
      .order("scraped_at", {
        ascending: false
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch scrape logs",
        error: error.message
      });
    }

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}


// ============================================
// MANUAL SCRAPE
// ============================================

async function manualScrape(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("tracked_products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: "Tracked product not found",
        error: error.message
      });
    }

    const result = await scrapeAndSave(data);

    res.json({
      success: result.success,
      message: result.success
        ? "Scrape completed successfully"
        : "Scrape failed",
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}


module.exports = {
  getTrackedProducts,
  getTrackedProduct,
  addTrackedProduct,
  getPriceHistory,
  getLatestPrice,
  getScrapeLogs,
  manualScrape
};