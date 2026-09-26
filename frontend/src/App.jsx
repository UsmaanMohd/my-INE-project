import { useEffect, useState } from "react";
import axios from "axios";

import HistoryChart from "./components/HistoryChart";
import ScrapeLogs from "./components/ScrapeLogs";

import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddModal, setShowAddModal] =
    useState(false);
  const [addingProduct, setAddingProduct] =
    useState(false);
  const [addMessage, setAddMessage] =
    useState("");

  const [searchQuery, setSearchQuery] =
    useState("");
  const [searchResults, setSearchResults] =
    useState([]);
  const [searching, setSearching] =
    useState(false);
  const [searchError, setSearchError] =
    useState("");

  const [selectedProduct, setSelectedProduct] =
    useState(null);
  const [loadingOptions, setLoadingOptions] =
    useState(false);
  const [productOptions, setProductOptions] =
    useState([]);
  const [optionGroup, setOptionGroup] =
    useState("Option");
  const [selectedOption, setSelectedOption] =
    useState("");

  async function fetchProducts() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${API_URL}/products`,
        {
          timeout: 15000
        }
      );

      setProducts(
        response.data.data || []
      );
    } catch (err) {
      console.error(
        "Fetch products error:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to load tracked products."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  function resetAddModal() {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSelectedProduct(null);
    setLoadingOptions(false);
    setProductOptions([]);
    setOptionGroup("Option");
    setSelectedOption("");
    setAddMessage("");
  }

  function openAddModal() {
    resetAddModal();
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (!addingProduct) {
      setShowAddModal(false);
    }
  }

  async function handleSearch(event) {
    const value = event.target.value;

    setSearchQuery(value);
    setSearchError("");
    setSelectedProduct(null);
    setProductOptions([]);
    setSelectedOption("");

    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);

      const response = await axios.get(
        `${API_URL}/catalog/search`,
        {
          params: {
            q: value.trim()
          },
          timeout: 30000
        }
      );

      setSearchResults(
        response.data.data || []
      );
    } catch (err) {
      console.error(
        "Catalog search error:",
        err
      );

      setSearchResults([]);

      setSearchError(
        err.response?.data?.message ||
          "Unable to search products."
      );
    } finally {
      setSearching(false);
    }
  }

  async function selectCatalogProduct(
    product
  ) {
    try {
      setSelectedProduct(product);
      setProductOptions([]);
      setSelectedOption("");
      setSearchError("");
      setLoadingOptions(true);

      const response = await axios.get(
        `${API_URL}/catalog/${product.id}/options`,
        {
          timeout: 60000
        }
      );

      const data =
        response.data.data || {};

      setProductOptions(
        data.options || []
      );

      setOptionGroup(
        data.optionGroup || "Option"
      );

      if (
        (data.options || []).length === 1
      ) {
        setSelectedOption(
          data.options[0].label
        );
      }
    } catch (err) {
      console.error(
        "Product options error:",
        err
      );

      setSelectedProduct(null);
      setProductOptions([]);

      setSearchError(
        err.response?.data?.message ||
          "Unable to load product options."
      );
    } finally {
      setLoadingOptions(false);
    }
  }

  function backToSearch() {
    setSelectedProduct(null);
    setProductOptions([]);
    setSelectedOption("");
    setSearchError("");
  }

  async function handleAddProduct(
    event
  ) {
    event.preventDefault();

    if (!selectedProduct) {
      setAddMessage(
        "Please select a product first."
      );
      return;
    }

    if (!selectedOption) {
      setAddMessage(
        `Please select an ${optionGroup.toLowerCase()}.`
      );
      return;
    }

    try {
      setAddingProduct(true);
      setAddMessage("");

      const payload = {
        store_product_id:
          String(selectedProduct.id),

        product_name:
          selectedProduct.name ||
          "Unnamed Product",

        selected_option:
          selectedOption,

        product_url:
          selectedProduct.url ||
          `https://demo.inelabteamdev.com/item/${selectedProduct.id}`
      };

      const response =
        await axios.post(
          `${API_URL}/products`,
          payload,
          {
            timeout: 30000
          }
        );

      if (response.data.success) {
        await fetchProducts();

        setAddMessage(
          "Product added successfully."
        );

        setTimeout(() => {
          setShowAddModal(false);
          resetAddModal();
        }, 800);
      } else {
        setAddMessage(
          response.data.message ||
            "Failed to add product."
        );
      }
    } catch (err) {
      console.error(
        "Add product error:",
        err
      );

      setAddMessage(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to add product."
      );
    } finally {
      setAddingProduct(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand-area">
            <div className="brand-mark">
              IN
            </div>

            <div>
              <h1>
                INE Price Tracker
              </h1>

              <p>
                Price, stock and scrape
                monitoring
              </p>
            </div>
          </div>

          <div className="header-status">
            <span className="status-dot"></span>
            Mock Store Monitoring
          </div>
        </div>
      </header>

      <main className="container">
        <section className="page-intro">
          <div>
            <span className="eyebrow">
              PRICE MONITORING
            </span>

            <h2>
              Tracked Products
            </h2>

            <p>
              Monitor current prices, stock
              availability and scraping
              history from the INE mock
              store.
            </p>
          </div>

          <button
            className="add-button"
            onClick={openAddModal}
          >
            <span className="plus">
              +
            </span>

            Add Product
          </button>
        </section>

        {!loading && !error && (
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                ◈
              </div>

              <div>
                <span>
                  Tracked Products
                </span>

                <strong>
                  {products.length}
                </strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">
                ✓
              </div>

              <div>
                <span>
                  Monitoring
                </span>

                <strong>
                  Active
                </strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                ↻
              </div>

              <div>
                <span>
                  Scrape Frequency
                </span>

                <strong>
                  2 Hours
                </strong>
              </div>
            </div>
          </section>
        )}

        {loading && (
          <div className="state-card">
            <div className="loader"></div>

            <p>
              Loading tracked products...
            </p>
          </div>
        )}

        {error && (
          <div className="state-card error-card">
            <strong>
              Something went wrong
            </strong>

            <p>{error}</p>

            <button
              onClick={fetchProducts}
            >
              Retry
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          products.length === 0 && (
            <div className="state-card">
              <div className="empty-icon">
                +
              </div>

              <h3>
                No products tracked yet
              </h3>

              <p>
                Search the INE mock store
                and start tracking a
                product.
              </p>

              <button
                className="add-button"
                onClick={openAddModal}
              >
                Add First Product
              </button>
            </div>
          )}

        {!loading &&
          !error &&
          products.length > 0 && (
            <div className="products-grid">
              {products.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                )
              )}
            </div>
          )}
      </main>

      {showAddModal && (
        <div
          className="modal-overlay"
          onMouseDown={closeAddModal}
        >
          <div
            className="modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  TRACK NEW PRODUCT
                </span>

                <h2>
                  Add Product
                </h2>

                <p>
                  Search the INE mock store
                  and choose an option.
                </p>
              </div>

              <button
                className="close-button"
                onClick={closeAddModal}
                disabled={
                  addingProduct
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleAddProduct
              }
              className="add-form"
            >
              {!selectedProduct && (
                <>
                  <div className="search-box">
                    <span className="search-icon">
                      ⌕
                    </span>

                    <input
                      type="text"
                      value={
                        searchQuery
                      }
                      onChange={
                        handleSearch
                      }
                      placeholder="Search product name, brand or SKU..."
                      autoFocus
                    />

                    {searching && (
                      <span className="search-spinner"></span>
                    )}
                  </div>

                  <div className="search-hint">
                    Type at least 2
                    characters, for
                    example
                    <strong>
                      {" "}
                      digital piano
                    </strong>
                    .
                  </div>

                  {searchError && (
                    <div className="form-error">
                      {searchError}
                    </div>
                  )}

                  {searchQuery.trim()
                      .length >= 2 &&
                    !searching &&
                    searchResults.length ===
                      0 &&
                    !searchError && (
                      <div className="no-results">
                        No matching
                        products found.
                      </div>
                    )}

                  {searchResults.length >
                    0 && (
                    <div className="catalog-results">
                      {searchResults.map(
                        (item) => (
                          <button
                            type="button"
                            className="catalog-result"
                            key={
                              item.id
                            }
                            onClick={() =>
                              selectCatalogProduct(
                                item
                              )
                            }
                          >
                            <div className="catalog-result-main">
                              <strong>
                                {
                                  item.name
                                }
                              </strong>

                              <span>
                                {item.brand ||
                                  "INE Store"}

                                {item.category
                                  ? ` · ${item.category}`
                                  : ""}
                              </span>
                            </div>

                            <div className="catalog-result-meta">
                              <span>
                                #
                                {
                                  item.id
                                }
                              </span>

                              <span>
                                ›
                              </span>
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {!searchQuery && (
                    <div className="search-empty">
                      <div className="search-empty-icon">
                        ⌕
                      </div>

                      <strong>
                        Find a product
                        to track
                      </strong>

                      <span>
                        Search by full
                        or partial
                        product name.
                      </span>
                    </div>
                  )}
                </>
              )}

              {selectedProduct && (
                <>
                  <div className="selected-product">
                    <button
                      type="button"
                      className="back-button"
                      onClick={
                        backToSearch
                      }
                      disabled={
                        loadingOptions ||
                        addingProduct
                      }
                    >
                      ← Change
                    </button>

                    <div className="selected-product-info">
                      <span className="selected-label">
                        SELECTED PRODUCT
                      </span>

                      <strong>
                        {
                          selectedProduct.name
                        }
                      </strong>

                      <span>
                        {selectedProduct.brand ||
                          "INE Store"}
                        {" · "}
                        ID #
                        {
                          selectedProduct.id
                        }
                      </span>
                    </div>
                  </div>

                  <div className="option-area">
                    <div className="option-heading">
                      <div>
                        <label>
                          {optionGroup}
                        </label>

                        <p>
                          Select the exact
                          option you want
                          to monitor.
                        </p>
                      </div>

                      {productOptions.length >
                        0 && (
                        <span>
                          {
                            productOptions.length
                          }{" "}
                          available
                        </span>
                      )}
                    </div>

                    {loadingOptions ? (
                      <div className="options-loading">
                        <div className="loader small"></div>

                        Loading product
                        options...
                      </div>
                    ) : productOptions.length >
                      0 ? (
                      <div className="option-list">
                        {productOptions.map(
                          (
                            option,
                            index
                          ) => (
                            <button
                              type="button"
                              key={`${option.label}-${index}`}
                              className={
                                selectedOption ===
                                option.label
                                  ? "option-chip selected"
                                  : "option-chip"
                              }
                              onClick={() =>
                                setSelectedOption(
                                  option.label
                                )
                              }
                            >
                              {
                                option.label
                              }

                              {selectedOption ===
                                option.label && (
                                <span>
                                  ✓
                                </span>
                              )}
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="no-options">
                        No selectable
                        options were found
                        for this product.
                      </div>
                    )}
                  </div>

                  {addMessage && (
                    <div
                      className={
                        addMessage.includes(
                          "successfully"
                        )
                          ? "form-success"
                          : "form-error"
                      }
                    >
                      {addMessage}
                    </div>
                  )}

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={
                        closeAddModal
                      }
                      disabled={
                        addingProduct
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="submit-button"
                      disabled={
                        addingProduct ||
                        loadingOptions ||
                        !selectedOption
                      }
                    >
                      {addingProduct
                        ? "Adding..."
                        : "Track Product"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product
}) {
  const [latest, setLatest] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const [logs, setLogs] =
    useState([]);

  const [scraping, setScraping] =
    useState(false);

  const [detailsLoading, setDetailsLoading] =
    useState(true);

  const [scrapeMessage, setScrapeMessage] =
    useState("");

  async function fetchLatest() {
    try {
      const response =
        await axios.get(
          `${API_URL}/products/${product.id}/latest`,
          {
            timeout: 15000
          }
        );

      setLatest(
        response.data.data || null
      );
    } catch (err) {
      console.error(
        "Latest price error:",
        err
      );

      setLatest(null);
    }
  }

  async function fetchHistory() {
    try {
      const response =
        await axios.get(
          `${API_URL}/products/${product.id}/history`,
          {
            timeout: 15000
          }
        );

      setHistory(
        response.data.data || []
      );
    } catch (err) {
      console.error(
        "History error:",
        err
      );

      setHistory([]);
    }
  }

  async function fetchLogs() {
    try {
      const response =
        await axios.get(
          `${API_URL}/products/${product.id}/logs`,
          {
            timeout: 15000
          }
        );

      setLogs(
        response.data.data || []
      );
    } catch (err) {
      console.error(
        "Logs error:",
        err
      );

      setLogs([]);
    }
  }

  async function fetchAllDetails() {
    setDetailsLoading(true);

    await Promise.all([
      fetchLatest(),
      fetchHistory(),
      fetchLogs()
    ]);

    setDetailsLoading(false);
  }

  useEffect(() => {
    fetchAllDetails();
  }, [product.id]);

  async function handleScrape() {
    if (scraping) {
      return;
    }

    console.log(
      "=============================="
    );

    console.log(
      "SCRAPE BUTTON CLICKED"
    );

    console.log(
      "Product DB ID:",
      product.id
    );

    console.log(
      "Product:",
      product.product_name
    );

    console.log(
      "API URL:",
      API_URL
    );

    console.log(
      "Scrape endpoint:",
      `${API_URL}/products/${product.id}/scrape`
    );

    console.log(
      "=============================="
    );

    try {
      setScraping(true);
      setScrapeMessage("");

      const response =
        await axios.post(
          `${API_URL}/products/${product.id}/scrape`,
          {},
          {
            timeout: 240000,
            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

      console.log(
        "SCRAPE RESPONSE:",
        response.data
      );

      if (response.data.success) {
        setScrapeMessage(
          response.data.message ||
            "Scrape completed successfully."
        );

        await fetchAllDetails();

        setTimeout(() => {
          setScrapeMessage("");
        }, 5000);
      } else {
        setScrapeMessage(
          response.data.message ||
            "Scrape failed."
        );

        await fetchAllDetails();
      }
    } catch (err) {
      console.error(
        "=============================="
      );

      console.error(
        "MANUAL SCRAPE ERROR:",
        err
      );

      console.error(
        "STATUS:",
        err.response?.status
      );

      console.error(
        "RESPONSE:",
        err.response?.data
      );

      console.error(
        "MESSAGE:",
        err.message
      );

      console.error(
        "=============================="
      );

      setScrapeMessage(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Scrape request failed."
      );

      await fetchAllDetails();
    } finally {
      setScraping(false);
    }
  }

  function handleExport() {
    window.open(
      `${API_URL}/products/${product.id}/export`,
      "_blank"
    );
  }

  const stockText =
    latest?.stock || "Unknown";

  const isSoldOut =
    /SOLD OUT|OUT OF STOCK/i.test(
      stockText
    );

  const successfulPoints =
    history.filter(
      (item) =>
        item.outcome === "success" &&
        item.price !== null
    ).length;

  return (
    <article className="product-card">
      <div className="product-top">
        <div className="product-title-area">
          <div className="product-category">
            INE MOCK STORE
          </div>

          <h3>
            {product.product_name}
          </h3>

          <p>
            Product ID #
            {product.store_product_id}
          </p>
        </div>

        <span className="option-badge">
          {product.selected_option}
        </span>
      </div>

      <div className="current-data">
        <div className="price-block">
          <span>
            Current price
          </span>

          <strong>
            {latest
              ? `₹${Number(
                  latest.price
                ).toLocaleString(
                  "en-IN"
                )}`
              : "--"}
          </strong>
        </div>

        <div
          className={
            isSoldOut
              ? "stock-block sold"
              : "stock-block"
          }
        >
          <span>
            Stock
          </span>

          <strong>
            {stockText}
          </strong>
        </div>
      </div>

      <div className="last-scrape">
        <div>
          <span>
            Last successful scrape
          </span>

          <strong>
            {latest
              ? new Date(
                  latest.scraped_at
                ).toLocaleString(
                  "en-IN",
                  {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  }
                )
              : "No successful scrape"}
          </strong>
        </div>

        <span className="success-badge">
          ● Live
        </span>
      </div>

      <div className="actions">
        <button
          className="scrape-button"
          onClick={handleScrape}
          disabled={scraping}
        >
          <span>↻</span>

          {scraping
            ? "Scraping..."
            : "Scrape Now"}
        </button>

        <button
          className="export-button"
          onClick={handleExport}
        >
          ↓ Export CSV
        </button>
      </div>

      {scrapeMessage && (
        <div
          className={
            scrapeMessage.includes(
              "successfully"
            )
              ? "scrape-success"
              : "scrape-error"
          }
        >
          {scrapeMessage}
        </div>
      )}

      <section className="dashboard-section">
        <div className="section-header">
          <div>
            <h4>
              Price History
            </h4>

            <p>
              Successful price
              observations
            </p>
          </div>

          <span className="section-count">
            {successfulPoints} points
          </span>
        </div>

        <div className="chart-wrapper">
          {detailsLoading ? (
            <div className="section-loading">
              Loading chart...
            </div>
          ) : (
            <HistoryChart
              history={history}
            />
          )}
        </div>
      </section>

      <section className="dashboard-section logs-section">
        <div className="section-header">
          <div>
            <h4>
              Scrape Activity
            </h4>

            <p>
              Every attempt and outcome
            </p>
          </div>

          <span className="section-count">
            {logs.length} attempts
          </span>
        </div>

        <div className="logs-wrapper">
          {detailsLoading ? (
            <div className="section-loading">
              Loading logs...
            </div>
          ) : (
            <ScrapeLogs
              logs={logs}
            />
          )}
        </div>
      </section>
    </article>
  );
}

export default App;