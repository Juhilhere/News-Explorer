// API key and API URL
const API_KEY = "5d4b338b-5ffe-435e-be9b-08fdb2869327";
const API_URL = "https://content.guardianapis.com/search?";

const searchButton = document.getElementById("searchBtn");
const searchInput = document.getElementById("search");
const newsContainer = document.getElementById("news-container");
const loadingSpinner = document.getElementById("loading-spinner");
const bookmarksBtn = document.getElementById("bookmarksBtn");
let isShowingBookmarks = false;
let currentQuery = "";

// Initialize IndexedDB for offline storage
let db;
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("NewsExplorerDB", 1);

    request.onerror = (event) => {
      console.error("Database error:", event.target.error);
      reject(event.target.error);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains("articles")) {
        db.createObjectStore("articles", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
  });
};

// Add these category mappings
const CATEGORY_MAPPINGS = {
  Technology: {
    section: "technology",
    tag: "technology/technology",
  },
  Science: {
    section: "science",
    tag: "science/science",
  },
  Health: {
    section: "society",
    tag: "society/health",
  },
  Sports: {
    section: "sport",
    tag: "sport/sport",
  },
  Business: {
    section: "business",
    tag: "business/business",
  },
};

// Add these tag mappings at the top with other constants
const TAG_MAPPINGS = {
  AI: {
    section: "technology",
    tag: "technology/artificial-intelligence,technology/machine-learning",
  },
  Climate: {
    section: "environment",
    tag: "environment/climate-change,environment/global-warming",
  },
  Space: {
    section: "science",
    tag: "science/space,science/astronomy",
  },
  COVID: {
    section: "world",
    tag: "world/coronavirus-outbreak,society/health",
  },
  Crypto: {
    section: "technology",
    tag: "technology/cryptocurrencies,business/bitcoin",
  },
};

// Add this function to fetch category-specific news
async function fetchCategoryNews(category) {
  // Extract just the category name without the icon
  const categoryName = category.split(" ").pop();
  const categoryInfo = CATEGORY_MAPPINGS[categoryName];

  if (!categoryInfo) {
    console.error("Invalid category:", categoryName);
    return;
  }

  const url = `${API_URL}section=${categoryInfo.section}&tag=${categoryInfo.tag}&show-fields=thumbnail,bodyText&page-size=10&api-key=${API_KEY}`;

  showLoadingSpinner();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    const articles = data.response.results.map((article) => ({
      ...article,
      id:
        article.id || article.webUrl || Math.random().toString(36).substr(2, 9),
    }));

    hideLoadingSpinner();
    displayNews(articles);
    addActivity(`Browsing ${categoryName} news`);
  } catch (error) {
    console.error(`Error fetching ${categoryName} news:`, error);
    hideLoadingSpinner();
    newsContainer.innerHTML = `<p class="placeholder">Error loading ${categoryName} news: ${error.message}</p>`;
  }
}

// Add this function to fetch tag-specific news with better error handling
async function fetchTagNews(tagName) {
  const tagInfo = TAG_MAPPINGS[tagName];
  if (!tagInfo) {
    console.error(`No mapping found for tag: ${tagName}`);
    return fetchNews(tagName); // Fallback to regular search
  }

  const url = `${API_URL}section=${tagInfo.section}&tag=${tagInfo.tag}&show-fields=thumbnail,bodyText&page-size=10&order-by=newest&api-key=${API_KEY}`;

  showLoadingSpinner();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (!data.response.results || data.response.results.length === 0) {
      // If no results found with specific tags, fallback to search
      return fetchNews(tagName);
    }

    const articles = data.response.results.map((article) => ({
      ...article,
      id:
        article.id || article.webUrl || Math.random().toString(36).substr(2, 9),
    }));

    hideLoadingSpinner();
    displayNews(articles);
    addActivity(`Browsing #${tagName} news`);
  } catch (error) {
    console.error(`Error fetching ${tagName} news:`, error);
    hideLoadingSpinner();
    newsContainer.innerHTML = `<p class="placeholder">Error loading ${tagName} news: ${error.message}</p>`;
  }
}

// Initialize database when page loads
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initDB();
    addActivity("Started browsing");
    loadRandomNews();

    // Quick navigation button event listeners
    const topicButtons = document.querySelectorAll(".topic-list button");
    topicButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        // Remove active class from all buttons
        topicButtons.forEach((btn) => btn.classList.remove("active"));
        // Add active class to clicked button
        button.classList.add("active");

        // Get the text content without the icon
        const category = button.textContent.trim();
        fetchCategoryNews(category);
      });
    });

    // Update trending tags event listeners with better handling
    const trendingTags = document.querySelectorAll(".tag");
    trendingTags.forEach((tag) => {
      tag.addEventListener("click", async (e) => {
        e.preventDefault();

        // Remove selected class from all tags
        trendingTags.forEach((t) => t.classList.remove("selected"));
        // Add selected class to clicked tag
        tag.classList.add("selected");

        // Get tag name without the # symbol
        const tagName = tag.querySelector("span").textContent.replace("#", "");

        // Clear any active category buttons
        document.querySelectorAll(".topic-list button").forEach((btn) => {
          btn.classList.remove("active");
        });

        await fetchTagNews(tagName);
      });
    });
  } catch (error) {
    console.error("Failed to initialize:", error);
  }
});

// Event listener for search button
searchButton.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (!query) {
    alert("Please enter a keyword to search!");
    return;
  }
  fetchNews(query);
});

// Activity tracking
let activityLog = [];
const MAX_ACTIVITIES = 5;

// Add activity to log
function addActivity(activity) {
  const timestamp = new Date();
  activityLog.unshift({ activity, timestamp });
  if (activityLog.length > MAX_ACTIVITIES) {
    activityLog.pop();
  }
  updateActivityFeed();
}

// Update activity feed in the UI
function updateActivityFeed() {
  const activityFeed = document.querySelector(".activity-feed");
  const activityItems = activityLog
    .map((item) => {
      const timeAgo = getTimeAgo(item.timestamp);
      return `
            <div class="activity-item">
                <p>${item.activity}</p>
                <span class="activity-time">${timeAgo}</span>
            </div>
        `;
    })
    .join("");

  const activityContainer = activityFeed.querySelector(":scope > div");
  if (activityContainer) {
    activityContainer.innerHTML = activityItems;
  } else {
    activityFeed.innerHTML += `<div>${activityItems}</div>`;
  }
}

// Get time ago string
function getTimeAgo(timestamp) {
  const seconds = Math.floor((new Date() - timestamp) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (let [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }
  return "just now";
}

// Modified fetchNews function
async function fetchNews(query) {
  currentQuery = query;
  const url = `${API_URL}q=${query}&show-fields=thumbnail,bodyText&page-size=10&api-key=${API_KEY}`;

  showLoadingSpinner();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    // Ensure each article has an id
    const articles = data.response.results.map((article) => ({
      ...article,
      id:
        article.id || article.webUrl || Math.random().toString(36).substr(2, 9),
    }));

    hideLoadingSpinner();
    displayNews(articles);
    addActivity(`Searched for "${query}"`);
  } catch (error) {
    console.error("Error fetching news:", error);
    hideLoadingSpinner();
    newsContainer.innerHTML = `<p class="placeholder">Error loading news: ${error.message}</p>`;
  }
}

// Function to display news
function displayNews(articles) {
  newsContainer.innerHTML = "";

  if (!articles || articles.length === 0) {
    newsContainer.innerHTML = `<p class="placeholder">No news found for the given keyword.</p>`;
    return;
  }

  articles.forEach(async (article) => {
    const newsCard = document.createElement("div");
    newsCard.className = "news-card";

    // Ensure article has an id
    if (!article.id) {
      article.id = article.webUrl || Math.random().toString(36).substr(2, 9);
    }

    const isBookmarked = await checkIfBookmarked(article.id);
    const bookmarkClass = isBookmarked ? "active" : "";

    const thumbnail = article.fields?.thumbnail
      ? `<img src="${article.fields.thumbnail}" alt="Article thumbnail">`
      : "";

    newsCard.innerHTML = `
      ${thumbnail}
      <i class="fas fa-bookmark bookmark-icon ${bookmarkClass}" data-id="${
      article.id
    }"></i>
      <h2>${article.webTitle}</h2>
      <p>${
        article.fields?.bodyText?.substring(0, 200) ||
        "No description available."
      }...</p>
      <a href="${article.webUrl}" target="_blank">Read more</a>
    `;

    // Add bookmark functionality
    const bookmarkIcon = newsCard.querySelector(".bookmark-icon");
    bookmarkIcon.addEventListener("click", () => toggleBookmark(article));

    newsContainer.appendChild(newsCard);
  });
}

// Modified toggleBookmark function
async function toggleBookmark(article) {
  if (!db) {
    console.error("Database not initialized");
    return;
  }

  try {
    const transaction = db.transaction(["articles"], "readwrite");
    const store = transaction.objectStore("articles");

    // Check if article exists
    const existing = await new Promise((resolve, reject) => {
      const request = store.get(article.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (existing) {
      // Delete bookmark
      await new Promise((resolve, reject) => {
        const request = store.delete(article.id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      addActivity(`Removed bookmark: ${article.webTitle.substring(0, 30)}...`);
    } else {
      // Add bookmark
      await new Promise((resolve, reject) => {
        const request = store.add({ ...article, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      addActivity(`Added bookmark: ${article.webTitle.substring(0, 30)}...`);
    }

    // Update UI
    const icon = document.querySelector(
      `.bookmark-icon[data-id="${article.id}"]`
    );
    if (icon) {
      icon.classList.toggle("active");
    }
  } catch (error) {
    console.error("Error toggling bookmark:", error);
  }
}

// Modified showBookmarks function
async function showBookmarks() {
  if (!db) {
    console.error("Database not initialized");
    return;
  }

  try {
    const transaction = db.transaction(["articles"], "readonly");
    const store = transaction.objectStore("articles");

    const articles = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!articles || articles.length === 0) {
      newsContainer.innerHTML = `<p class="placeholder">No bookmarked articles yet.</p>`;
    } else {
      displayNews(articles);
      addActivity("Viewed bookmarks");
    }

    isShowingBookmarks = true;
    bookmarksBtn.classList.add("active");
  } catch (error) {
    console.error("Error showing bookmarks:", error);
    newsContainer.innerHTML = `<p class="placeholder">Error loading bookmarks: ${error.message}</p>`;
  }
}

// Function to show loading spinner
function showLoadingSpinner() {
  loadingSpinner.classList.add("active");
}

// Function to hide loading spinner
function hideLoadingSpinner() {
  loadingSpinner.classList.remove("active");
}

// Offline support
window.addEventListener("online", () => {
  document.querySelector(".offline-indicator")?.classList.remove("active");
});

window.addEventListener("offline", () => {
  document.querySelector(".offline-indicator")?.classList.add("active");
});

// Event listeners
bookmarksBtn.addEventListener("click", () => {
  if (isShowingBookmarks) {
    isShowingBookmarks = false;
    bookmarksBtn.classList.remove("active");
    if (currentQuery) {
      fetchNews(currentQuery);
    } else {
      loadRandomNews();
    }
    bookmarksBtn.innerHTML =
      '<i class="fas fa-bookmark"></i><span>Bookmarks</span>';
  } else {
    isShowingBookmarks = true;
    bookmarksBtn.classList.add("active");
    showBookmarks();
    bookmarksBtn.innerHTML =
      '<i class="fas fa-home"></i><span>Back to News</span>';
  }
});

// Add these constants at the top
const DEFAULT_TOPICS = [
  "technology",
  "science",
  "health",
  "environment",
  "business",
  "sports",
  "arts",
  "politics",
];

// Add this function to get random news
async function loadRandomNews() {
  const categories = Object.keys(CATEGORY_MAPPINGS);
  const randomCategory =
    categories[Math.floor(Math.random() * categories.length)];
  await fetchCategoryNews(randomCategory);
}

// Add this function to update statistics
function updateStats() {
  const statsItems = document.querySelectorAll(".stats-item span:last-child");
  if (statsItems.length >= 2) {
    // Update articles count
    statsItems[0].textContent = Math.floor(Math.random() * 200 + 100);
    // Update active users
    statsItems[1].textContent = Math.floor(
      Math.random() * 2000 + 1000
    ).toLocaleString();
  }
}

// Call updateStats periodically
setInterval(updateStats, 30000); // Updates every 30 seconds
updateStats(); // Initial update

// Modified checkIfBookmarked function
async function checkIfBookmarked(articleId) {
  if (!db) return false;

  try {
    const transaction = db.transaction(["articles"], "readonly");
    const store = transaction.objectStore("articles");

    const item = await new Promise((resolve, reject) => {
      const request = store.get(articleId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return !!item;
  } catch (error) {
    console.error("Error checking bookmark:", error);
    return false;
  }
}
