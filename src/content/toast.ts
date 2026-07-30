const TOAST_ID = "reality-splitter-toast";

export function showPageToast(message: string) {
  let toast = document.getElementById(TOAST_ID);

  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "reality-splitter-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("is-visible");

  window.clearTimeout(Number(toast.getAttribute("data-hide-timer") || "0"));
  const timerId = window.setTimeout(() => {
    toast?.classList.remove("is-visible");
  }, 2600);

  toast.setAttribute("data-hide-timer", String(timerId));
}
