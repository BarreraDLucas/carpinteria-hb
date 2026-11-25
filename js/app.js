/* Catálogo. Los trabajos viven en data/projects.json. */

const statusEl = document.querySelector("#catalog-status");
const gridEl = document.querySelector("#grid");
const filtersEl = document.querySelector("#filters");
const countEl = document.querySelector("#catalog-count");
const emptyEl = document.querySelector("#catalog-empty");
const lightbox = document.querySelector("#lightbox");
const lbImg = document.querySelector("#lb-img");
const lbCat = document.querySelector("#lb-cat");
const lbTitle = document.querySelector("#lb-title");
const lbDesc = document.querySelector("#lb-desc");
const lbCount = document.querySelector("#lb-count");
const lbPrev = document.querySelector("#lb-prev");
const lbNext = document.querySelector("#lb-next");

let projects = [];
let labels = new Map();
let activeFilter = "todos";
let openId = null;
let photoIndex = 0;
let lastFocus = null;
let touchX = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function labelFor(category) {
  return labels.get(category) || "Otros";
}

function updateFilterFade() {
  const wrap = filtersEl.parentElement;
  if (!wrap) return;
  const overflows = filtersEl.scrollWidth > filtersEl.clientWidth + 2;
  const atEnd = filtersEl.scrollLeft + filtersEl.clientWidth >= filtersEl.scrollWidth - 4;
  wrap.classList.toggle("can-scroll", overflows);
  wrap.classList.toggle("at-end", atEnd);
}

function renderFilters(categories) {
  const items = [{ id: "todos", label: "Todos" }, ...categories];
  filtersEl.innerHTML = items
    .map(
      (item, index) => `
        <button type="button" class="chip" role="tab" data-filter="${escapeHtml(item.id)}" aria-selected="${index === 0 ? "true" : "false"}">
          ${escapeHtml(item.label)}
        </button>`
    )
    .join("");
  updateFilterFade();
}

function renderGrid() {
  gridEl.innerHTML = projects
    .map((project, index) => {
      const count = project.images.length;
      const badge = count > 1 ? `<span class="card-photos">${count} fotos</span>` : "";
      const eager = index < 3 ? 'loading="eager"' : 'loading="lazy"';
      return `
        <article class="card" data-category="${escapeHtml(project.category)}">
          <button type="button" class="card-open" data-id="${escapeHtml(project.id)}">
            <span class="card-media">
              <img src="${escapeHtml(project.images[0])}" alt="" ${eager} width="800" height="800">
              ${badge}
            </span>
            <span class="card-copy">
              <span class="card-cat">${escapeHtml(labelFor(project.category))}</span>
              <span class="card-title">${escapeHtml(project.title)}</span>
              <span class="card-desc">${escapeHtml(project.description)}</span>
            </span>
          </button>
        </article>`;
    })
    .join("");
  applyFilter(activeFilter);
}

function applyFilter(filterId) {
  activeFilter = filterId;
  let shown = 0;
  gridEl.querySelectorAll(".card").forEach((card) => {
    const visible = filterId === "todos" || card.dataset.category === filterId;
    card.hidden = !visible;
    if (visible) shown += 1;
  });
  filtersEl.querySelectorAll(".chip").forEach((chip) => {
    chip.setAttribute("aria-selected", chip.dataset.filter === filterId ? "true" : "false");
  });
  const noun = shown === 1 ? "trabajo" : "trabajos";
  countEl.textContent = `${shown} ${noun}`;
  emptyEl.hidden = shown !== 0;
}

function currentProject() {
  return projects.find((project) => project.id === openId) || null;
}

function renderLightbox() {
  const project = currentProject();
  if (!project) return;
  const total = project.images.length;
  const src = project.images[photoIndex];
  lbImg.src = src;
  lbImg.alt = total > 1 ? `${project.title}, foto ${photoIndex + 1} de ${total}` : project.title;
  lbCat.textContent = labelFor(project.category);
  lbTitle.textContent = project.title;
  lbDesc.textContent = project.description;
  const multiple = total > 1;
  lbPrev.hidden = !multiple;
  lbNext.hidden = !multiple;
  lbCount.hidden = !multiple;
  lbCount.textContent = multiple ? `${photoIndex + 1} / ${total}` : "";
}

function openLightbox(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  openId = id;
  photoIndex = 0;
  lastFocus = document.activeElement;
  renderLightbox();
  lightbox.hidden = false;
  document.body.classList.add("is-locked");
  lightbox.querySelector(".lb-close").focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.classList.remove("is-locked");
  lbImg.removeAttribute("src");
  openId = null;
  if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
}

function step(delta) {
  const project = currentProject();
  if (!project || project.images.length < 2) return;
  const total = project.images.length;
  photoIndex = (photoIndex + delta + total) % total;
  renderLightbox();
}

filtersEl.addEventListener("scroll", updateFilterFade, { passive: true });
window.addEventListener("resize", updateFilterFade);

filtersEl.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  applyFilter(chip.dataset.filter);
});

gridEl.addEventListener("click", (event) => {
  const button = event.target.closest(".card-open");
  if (!button) return;
  openLightbox(button.dataset.id);
});

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

lightbox.querySelector(".lb-close").addEventListener("click", closeLightbox);
lbPrev.addEventListener("click", () => step(-1));
lbNext.addEventListener("click", () => step(1));

document.addEventListener("keydown", (event) => {
  if (lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowRight") step(1);
  if (event.key === "ArrowLeft") step(-1);
});

lbImg.addEventListener(
  "touchstart",
  (event) => {
    touchX = event.changedTouches[0].clientX;
  },
  { passive: true }
);

lbImg.addEventListener(
  "touchend",
  (event) => {
    if (touchX == null) return;
    const delta = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(delta) < 40) return;
    step(delta < 0 ? 1 : -1);
  },
  { passive: true }
);

async function init() {
  try {
    const response = await fetch("data/projects.json");
    if (!response.ok) throw new Error("No se pudo leer el catálogo");
    const data = await response.json();
    projects = Array.isArray(data.projects) ? data.projects : [];
    labels = new Map((data.categories || []).map((category) => [category.id, category.label]));
    renderFilters(data.categories || []);
    renderGrid();
    statusEl.hidden = true;
    gridEl.hidden = false;
  } catch (error) {
    statusEl.textContent = "No se pudieron cargar los trabajos. Recargá la página.";
    statusEl.classList.add("is-error");
  }
}

init();
