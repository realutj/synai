// Terminal typing animation
const commandText = 'synai "merhaba dünya uygulaması yap"';
let charIndex = 0;

function typeCommand() {
  const commandElement = document.getElementById("typedCommand");
  if (charIndex < commandText.length) {
    commandElement.textContent = commandText.substring(0, charIndex + 1);
    charIndex++;
    setTimeout(typeCommand, 80);
  } else {
    // Show responses after typing completes
    setTimeout(() => {
      document.getElementById("response1").classList.remove("hidden");
      setTimeout(() => {
        document.getElementById("response2").classList.remove("hidden");
        setTimeout(() => {
          document.getElementById("output").classList.remove("hidden");
        }, 800);
      }, 1200);
    }, 500);
  }
}

// Start typing animation when page loads
window.addEventListener("load", () => {
  setTimeout(typeCommand, 1000);
});

// Copy to clipboard functionality
document.querySelectorAll(".copy-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const textToCopy = button.getAttribute("data-copy");
    try {
      await navigator.clipboard.writeText(textToCopy);

      // Visual feedback
      const originalHTML = button.innerHTML;
      button.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
      button.style.borderColor = "var(--success)";

      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.borderColor = "";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  });
});

// Mobile menu toggle
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const navLinks = document.querySelector(".nav-links");

mobileMenuBtn?.addEventListener("click", () => {
  navLinks.classList.toggle("active");
  mobileMenuBtn.classList.toggle("active");
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href !== "#" && href !== "") {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        // Close mobile menu if open
        navLinks?.classList.remove("active");
        mobileMenuBtn?.classList.remove("active");
      }
    }
  });
});

// Create floating particles
function createParticles() {
  const particlesContainer = document.getElementById("particles");
  if (!particlesContainer) return;

  const particleCount = 30;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";

    // Random position
    particle.style.left = Math.random() * 100 + "%";
    particle.style.top = Math.random() * 100 + "%";

    // Random animation delay
    particle.style.animationDelay = Math.random() * 20 + "s";

    // Random size
    const size = Math.random() * 4 + 2;
    particle.style.width = size + "px";
    particle.style.height = size + "px";

    particlesContainer.appendChild(particle);
  }
}

// Initialize particles
createParticles();

// Intersection Observer for fade-in animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("fade-in");
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe feature cards
document.querySelectorAll(".feature-card, .install-card").forEach((card) => {
  observer.observe(card);
});

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll > 100) {
    navbar.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.3)";
  } else {
    navbar.style.boxShadow = "";
  }

  lastScroll = currentScroll;
});

// Add loading animation to external links
document.querySelectorAll('a[target="_blank"]').forEach((link) => {
  link.addEventListener("click", function (e) {
    this.style.opacity = "0.6";
    setTimeout(() => {
      this.style.opacity = "";
    }, 300);
  });
});

// Easter egg: Konami code
let konamiCode = [];
const konamiSequence = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

document.addEventListener("keydown", (e) => {
  konamiCode.push(e.key);
  konamiCode = konamiCode.slice(-10);

  if (konamiCode.join(",") === konamiSequence.join(",")) {
    const confetti = document.createElement("div");
    confetti.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            z-index: 9999;
            animation: fadeIn 0.5s ease-out;
        `;
    confetti.textContent = "🎉 SynAI Rocks! 🚀";
    document.body.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, 3000);
  }
});

// Performance: Lazy load images
if ("loading" in HTMLImageElement.prototype) {
  document.querySelectorAll("img").forEach((img) => {
    img.loading = "lazy";
  });
}

// Console message
console.log(
  "%c🚀 SynAI",
  "font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #38bdf8 0%, #a855f7 100%); -webkit-background-clip: text; color: transparent;",
);
console.log(
  "%cAçık kaynak AI kodlama asistanı",
  "font-size: 14px; color: #94a3b8;",
);
console.log(
  "%chttps://github.com/synai/synai",
  "font-size: 14px; color: #38bdf8;",
);
