document.addEventListener('DOMContentLoaded', () => {
  const hero = document.getElementById('hero');
  const subtitle = document.querySelector('.hero-subtitle');
  const serviceSearch = document.getElementById('serviceSearch');
  const serviceSearchCount = document.getElementById('serviceSearchCount');
  const serviceCards = document.querySelectorAll('#services .service-card');
  const noticeTrack = document.querySelector('.notice-track');
  const openStatus = document.getElementById('openStatus');
  const todayDateItems = document.querySelectorAll('.today-date');

  if (!hero) {
    return;
  }

  const colors = [
    '#FFD700',
    '#FF2D78',
    '#00F5FF',
    '#00FF88',
    '#FF6B00'
  ];

  for (let i = 0; i < 18; i++) {
    const particle = document.createElement('div');
    const size = Math.random() * 6 + 3;

    particle.className = 'particle';
    particle.style.cssText = `
      width:${size}px;
      height:${size}px;
      left:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration:${Math.random() * 12 + 8}s;
      animation-delay:${Math.random() * 10}s;
      opacity:0.4;
    `;

    hero.appendChild(particle);
  }

  const fadeItems = document.querySelectorAll('.fade-in');
  const counters = document.querySelectorAll('.counter-number');
  const contactForm = document.getElementById('contactForm');

  if (todayDateItems.length) {
    const today = new Date();
    const readableDate = today.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const machineDate = today.toISOString().slice(0, 10);

    todayDateItems.forEach((item) => {
      item.textContent = `Updated ${readableDate}`;

      if (item.tagName.toLowerCase() === 'time') {
        item.setAttribute('datetime', machineDate);
      }
    });
  }

  if (noticeTrack) {
    noticeTrack.innerHTML += noticeTrack.innerHTML;
  }

  if (serviceSearch && serviceSearchCount) {
    const updateServiceSearch = () => {
      const query = serviceSearch.value.trim().toLowerCase();
      let visibleCount = 0;

      serviceCards.forEach((card) => {
        const content = card.textContent.toLowerCase();
        const isVisible = content.includes(query);

        card.classList.toggle('is-hidden', !isVisible);

        if (isVisible) {
          visibleCount += 1;
        }
      });

      serviceSearchCount.textContent = query
        ? `${visibleCount} service found`
        : 'All services available';
    };

    serviceSearch.addEventListener('input', updateServiceSearch);
  }

  if (openStatus) {
    const now = new Date();
    const hour = now.getHours();
    const isOpen = hour >= 8 && hour < 21;

    openStatus.textContent = isOpen
      ? 'Open Now - 8 AM to 9 PM'
      : 'Closed Now - Opens at 8 AM';
    openStatus.classList.toggle('is-closed', !isOpen);
  }

  if (subtitle) {
    const subtitleText = subtitle.textContent.trim();
    subtitle.textContent = '';
    subtitle.setAttribute('aria-label', subtitleText);

    let letter = 0;
    const typeText = () => {
      subtitle.textContent = subtitleText.slice(0, letter);
      letter += 1;

      if (letter <= subtitleText.length) {
        window.setTimeout(typeText, 38);
      }
    };

    typeText();
  }

  const runCounter = (counter) => {
    const target = Number(counter.dataset.target || 0);
    const duration = 1300;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.floor(progress * target);
      counter.textContent = value.toLocaleString('en-IN');

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  };

  if (contactForm) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const name = document.getElementById('customerName').value.trim();
      const mobile = document.getElementById('customerMobile').value.trim();
      const service = document.getElementById('serviceRequired').value;
      const message = `Hello DS Online Digital Studio, my name is ${name}. Mobile: ${mobile}. Service required: ${service}.`;
      const url = `https://wa.me/919142153863?text=${encodeURIComponent(message)}`;

      window.open(url, '_blank', 'noopener');
      contactForm.reset();
    });
  }

  if (!('IntersectionObserver' in window)) {
    fadeItems.forEach(el => el.classList.add('visible'));
    counters.forEach(runCounter);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (!entry.isIntersecting) {
        return;
      }

      setTimeout(() => {
        entry.target.classList.add('visible');
      }, index * 80);

      if (entry.target.classList.contains('counter-card')) {
        const counter = entry.target.querySelector('.counter-number');

        if (counter && !counter.dataset.counted) {
          counter.dataset.counted = 'true';
          runCounter(counter);
        }
      }

      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.1
  });

  fadeItems.forEach(el => {
    observer.observe(el);
  });
});
