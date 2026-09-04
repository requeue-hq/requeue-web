(function () {
  var WAITLIST_EMAIL = "maya.chen.yvr@agentmail.to";
  var form = document.getElementById("waitlist-form");
  var statusEl = document.getElementById("waitlist-status");
  var yearEl = document.getElementById("year");
  var navToggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function encodeMailto(subject, body) {
    return (
      "mailto:" +
      WAITLIST_EMAIL +
      "?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body)
    );
  }

  function buildBody(email, product, source) {
    var lines = [
      "I'd like to join the Requeue waitlist.",
      "",
      "Email: " + email,
    ];
    if (product) {
      lines.push("What I ship: " + product);
    }
    if (source) {
      lines.push("Where things fail today: " + source);
    }
    lines.push("", "— sent from requeue-web waitlist");
    return lines.join("\n");
  }

  if (form && statusEl) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var emailInput = form.elements.namedItem("email");
      var productInput = form.elements.namedItem("product");
      var sourceInput = form.elements.namedItem("source");

      var email = emailInput && "value" in emailInput ? emailInput.value.trim() : "";
      var product = productInput && "value" in productInput ? productInput.value.trim() : "";
      var source = sourceInput && "value" in sourceInput ? sourceInput.value.trim() : "";

      if (!email) {
        statusEl.textContent = "Add an email so Maya can write you back.";
        statusEl.dataset.state = "error";
        if (emailInput && "focus" in emailInput) {
          emailInput.focus();
        }
        return;
      }

      var href = encodeMailto(
        "Requeue waitlist",
        buildBody(email, product, source)
      );

      statusEl.innerHTML =
        "Opening your email client to <a href=\"" +
        href +
        "\">" +
        WAITLIST_EMAIL +
        "</a>. If nothing opens, copy that address and send the note yourself.";
      statusEl.dataset.state = "ok";

      window.location.href = href;
    });
  }
})();
