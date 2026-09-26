import { useEffect, useState } from "react";
import axios from "axios";

import HistoryChart from "./components/HistoryChart";
import ScrapeLogs from "./components/ScrapeLogs";

import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);

  const [formData, setFormData] = useState({
    store_product_id: "",
    product_name: "",
    selected_option: "",
    product_url: ""
  });

  const [addingProduct, setAddingProduct] = useState(false);
  const [addMessage, setAddMessage] = useState("");

  async function fetchProducts() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${API_URL}/products`
      );

      setProducts(response.data.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load tracked products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  function openAddModal() {
    setFormData({
      store_product_id: "",
      product_name: "",
      selected_option: "",
      product_url: ""
    });

    setAddMessage("");
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (!addingProduct) {
      setShowAddModal(false);
    }
  }

  async function handleAddProduct(event) {
    event.preventDefault();

    if (
      !formData.store_product_id ||
      !formData.product_name ||
      !formData.selected_option ||
      !formData.product_url
    ) {
      setAddMessage(
        "Please fill all fields."
      );
      return;
    }

    try {
      setAddingProduct(true);
      setAddMessage("");

      const response = await axios.post(
        `${API_URL}/products`,
        formData
      );

      if (response.data.success) {
        setAddMessage(
          "Product added successfully."
        );

        await fetchProducts();

        setTimeout(() => {
          setShowAddModal(false);
          setAddMessage("");
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
        <div>
          <h1>INE Price Tracker</h1>

          <p>
            Monitor product prices, stock and
            scraping history
          </p>
        </div>
      </header>

      <main className="container">

        <section className="top-section">

          <div>
            <h2>Tracked Products</h2>

            <p className="subtitle">
              Products currently being monitored
            </p>
          </div>

          <button
            className="add-button"
            onClick={openAddModal}
          >
            + Add Product
          </button>

        </section>

        {loading && (
          <div className="message">
            Loading products...
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          products.length === 0 && (
            <div className="message">
              No tracked products found.
            </div>
          )}

        <div className="products-grid">

          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}

        </div>

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
                <h2>
                  Add Product
                </h2>

                <p>
                  Add a mock-store product for
                  price tracking.
                </p>
              </div>

              <button
                className="close-button"
                onClick={closeAddModal}
                disabled={addingProduct}
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleAddProduct}
              className="add-form"
            >

              <div className="form-group">

                <label>
                  Product Name
                </label>

                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Junova Travel Router Nano"
                />

              </div>

              <div className="form-group">

                <label>
                  Store Product ID
                </label>

                <input
                  type="text"
                  name="store_product_id"
                  value={formData.store_product_id}
                  onChange={handleInputChange}
                  placeholder="e.g. 2638"
                />

              </div>

              <div className="form-group">

                <label>
                  Product URL
                </label>

                <input
                  type="url"
                  name="product_url"
                  value={formData.product_url}
                  onChange={handleInputChange}
                  placeholder="https://demo.inelabteamdev.com/item/2638"
                />

              </div>

              <div className="form-group">

                <label>
                  Selected Option
                </label>

                <input
                  type="text"
                  name="selected_option"
                  value={formData.selected_option}
                  onChange={handleInputChange}
                  placeholder="e.g. 2-pack"
                />

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
                  onClick={closeAddModal}
                  disabled={addingProduct}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="submit-button"
                  disabled={addingProduct}
                >
                  {addingProduct
                    ? "Adding..."
                    : "Add Product"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}


function ProductCard({ product }) {

  const [latest, setLatest] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const [logs, setLogs] =
    useState([]);

  const [scraping, setScraping] =
    useState(false);

  const [scrapeMessage, setScrapeMessage] =
    useState("");

  const [detailsLoading, setDetailsLoading] =
    useState(true);


  async function fetchLatest() {
    try {
      const response =
        await axios.get(
          `${API_URL}/products/${product.id}/latest`
        );

      setLatest(
        response.data.data
      );
    } catch (err) {
      console.error(
        "Latest price error:",
        err
      );
    }
  }


  async function fetchHistory() {
    try {
      const response =
        await axios.get(
          `${API_URL}/products/${product.id}/history`
        );

      setHistory(
        response.data.data || []
      );
    } catch (err) {
      console.error(
        "History error:",
        err
      );
    }
  }


  async function fetchLogs() {
    try {
      const response =
        await axios.get(
          `${API_URL}/products/${product.id}/logs`
        );

      setLogs(
        response.data.data || []
      );
    } catch (err) {
      console.error(
        "Logs error:",
        err
      );
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

    try {

      setScraping(true);
      setScrapeMessage("");

      const response =
        await axios.post(
          `${API_URL}/products/${product.id}/scrape`
        );

      if (response.data.success) {

        setScrapeMessage(
          "Scrape completed successfully."
        );

      } else {

        setScrapeMessage(
          "Scrape failed."
        );

      }

      await fetchAllDetails();

    } catch (err) {

      console.error(
        "Manual scrape error:",
        err
      );

      setScrapeMessage(
        "Scrape request failed."
      );

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


  return (

    <div className="product-card">

      <div className="product-header">

        <div>

          <h3>
            {product.product_name}
          </h3>

          <p className="product-id">
            Store Product ID:{" "}
            {product.store_product_id}
          </p>

        </div>

        <span className="option-badge">
          {product.selected_option}
        </span>

      </div>


      <div className="price-section">

        <div className="info-box">

          <span>
            Current Price
          </span>

          <strong>

            {latest
              ? `₹${Number(
                  latest.price
                ).toLocaleString("en-IN")}`
              : "--"}

          </strong>

        </div>


        <div className="info-box">

          <span>
            Stock
          </span>

          <strong className="stock">

            {latest
              ? latest.stock
              : "--"}

          </strong>

        </div>

      </div>


      <div className="last-update">

        <span>
          Last successful scrape:
        </span>

        <span>

          {latest
            ? new Date(
                latest.scraped_at
              ).toLocaleString("en-IN")
            : "No successful scrape yet"}

        </span>

      </div>


      {scrapeMessage && (

        <div className="scrape-message">

          {scrapeMessage}

        </div>

      )}


      <div className="actions">

        <button
          className="scrape-button"
          onClick={handleScrape}
          disabled={scraping}
        >

          {scraping
            ? "Scraping..."
            : "Scrape Now"}

        </button>


        <button
          className="export-button"
          onClick={handleExport}
        >

          Export CSV

        </button>

      </div>


      <section className="dashboard-section">

        <div className="section-header">

          <div>

            <h3>
              Price History
            </h3>

            <p>
              Successful price observations
            </p>

          </div>

        </div>


        {detailsLoading ? (

          <div className="section-loading">
            Loading history...
          </div>

        ) : (

          <HistoryChart
            history={history}
          />

        )}

      </section>


      <section className="dashboard-section">

        <div className="section-header">

          <div>

            <h3>
              Scrape Logs
            </h3>

            <p>
              Every scraping attempt and outcome
            </p>

          </div>

        </div>


        {detailsLoading ? (

          <div className="section-loading">
            Loading logs...
          </div>

        ) : (

          <ScrapeLogs
            logs={logs}
          />

        )}

      </section>

    </div>

  );
}


export default App;