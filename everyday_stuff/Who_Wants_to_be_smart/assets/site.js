function toggleMenu() {
  const menu = document.getElementById("mobile-menu");
  if (!menu) return;
  menu.classList.toggle("open");
}

document.querySelectorAll("[data-close-menu]").forEach((link) => {
  link.addEventListener("click", () => {
    const menu = document.getElementById("mobile-menu");
    if (!menu) return;
    menu.classList.remove("open");
  });
});

const yearNode = document.getElementById("year");
if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}
