const express = require("express");

const {
  searchProducts,
  getProductOptions
} = require("../controllers/catalogController");

const router = express.Router();

router.get(
  "/search",
  searchProducts
);

router.get(
  "/:id/options",
  getProductOptions
);

module.exports = router;