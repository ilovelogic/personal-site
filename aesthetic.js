const STORAGE_KEY = "poetry-theme";
const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");

function setTheme(theme) {
  root.dataset.theme = theme;
  toggle.textContent = theme === "dusk" ? "Light the lanterns" : "Let the sun set";
  toggle.setAttribute("aria-pressed", theme === "dusk");
}

// The markup ships the button hidden so it never sits there dead without JS.
toggle.hidden = false;
setTheme(localStorage.getItem(STORAGE_KEY) === "dusk" ? "dusk" : "dawn");

toggle.addEventListener("click", () => {
  const next = root.dataset.theme === "dusk" ? "dawn" : "dusk";
  setTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
});
