document.addEventListener('DOMContentLoaded', () => {
    const feedbackForm = document.getElementById('feedbackForm');
    const feedbackFormStatus = document.getElementById('feedbackFormStatus');
    const feedbackList = document.getElementById('feedbackList');
    const publicFeedbackList = document.getElementById('publicFeedbackList');
    const feedbackCount = document.getElementById('feedbackCount');
    const feedbackSyncStatus = document.getElementById('feedbackSyncStatus');
    const feedbackStorageKey = 'dsCustomerFeedback';
    const feedbackDatabaseUrl = window.DS_FEEDBACK_DATABASE_URL ? window.DS_FEEDBACK_DATABASE_URL.trim().replace(/\/$/, '') : '';
    let feedbackItems = readLocalFeedback();

    function readLocalFeedback() {
        try {
            const items = JSON.parse(localStorage.getItem(feedbackStorageKey) || '[]');
            return Array.isArray(items) ? items : [];
        } catch {
            return [];
        }
    }

    function formatFeedbackDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ?
            '' :
            date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }

    function createFeedbackCard(item) {
        const card = document.createElement('article');
        const stars = document.createElement('div');
        const message = document.createElement('p');
        const name = document.createElement('h3');
        const date = document.createElement('time');
        const rating = Math.min(5, Math.max(1, Number(item.rating) || 0));

        card.className = 'review-box feedback-review';
        stars.className = 'review-stars';
        stars.textContent = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
        stars.setAttribute('aria-label', `${rating} out of 5 stars`);
        message.className = 'review-text';
        message.textContent = `“${String(item.message || '')}”`;
        name.textContent = String(item.name || 'Customer');
        date.className = 'feedback-date';
        date.dateTime = String(item.createdAt || '');
        date.textContent = formatFeedbackDate(item.createdAt);
        card.append(stars, message, name, date);
        return card;
    }

    function renderFeedback() {
        const latestItems = feedbackItems
            .filter((item) => item && item.name && item.message)
            .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
            .slice(0, 50);

        [feedbackList, publicFeedbackList].forEach((container) => {
            if (!container) return;
            container.replaceChildren();

            if (!latestItems.length) {
                const emptyMessage = document.createElement('p');
                emptyMessage.className = 'feedback-empty';
                emptyMessage.textContent = container === feedbackList ?
                    'No customer feedback yet.' :
                    'Customer reviews yahan dikhai denge.';
                container.appendChild(emptyMessage);
                return;
            }

            latestItems.forEach((item) => container.appendChild(createFeedbackCard(item)));
        });

        if (feedbackCount) {
            feedbackCount.textContent = `${feedbackItems.length} ${feedbackItems.length === 1 ? 'review' : 'reviews'}`;
        }
    }

    function setFeedbackStatus(message) {
        if (feedbackSyncStatus) feedbackSyncStatus.textContent = message;
    }

    function saveLocalFeedback(item) {
        feedbackItems = [item, ...feedbackItems].slice(0, 100);
        localStorage.setItem(feedbackStorageKey, JSON.stringify(feedbackItems));
        renderFeedback();
    }

    if (feedbackForm && feedbackFormStatus) {
        renderFeedback();

        feedbackForm.addEventListener('submit', async(event) => {
            event.preventDefault();
            const formData = new FormData(feedbackForm);
            const item = {
                name: String(formData.get('name') || '').trim(),
                rating: Number(formData.get('rating')),
                message: String(formData.get('message') || '').trim(),
                createdAt: new Date().toISOString()
            };

            if (!item.name || !item.message || item.rating < 1 || item.rating > 5) {
                feedbackFormStatus.textContent = 'Kripya naam, rating aur feedback sahi se bharein.';
                return;
            }

            const submitButton = feedbackForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            feedbackFormStatus.textContent = 'Feedback bheja ja raha hai...';

            try {
                if (feedbackDatabaseUrl) {
                    const response = await fetch(`${feedbackDatabaseUrl}/feedback.json`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(item)
                    });

                    if (!response.ok) throw new Error('Feedback could not be saved to the shared database.');
                    item.id = (await response.json()).name;
                    feedbackItems = [item, ...feedbackItems.filter((savedItem) => savedItem.id !== item.id)];
                    renderFeedback();
                    feedbackFormStatus.textContent = 'Dhanyavaad! Aapka feedback sabhi devices par share ho gaya.';
                } else {
                    item.id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    saveLocalFeedback(item);
                    feedbackFormStatus.textContent = 'Dhanyavaad! Feedback is browser mein save hua. Shared live dashboard ke liye database setup zaroori hai.';
                }

                feedbackForm.reset();
            } catch (error) {
                feedbackFormStatus.textContent = error.message || 'Feedback abhi submit nahi ho paya. Kripya dobara try karein.';
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    if (feedbackDatabaseUrl && feedbackList) {
        fetch(`${feedbackDatabaseUrl}/feedback.json`)
            .then((response) => {
                if (!response.ok) throw new Error('Database read failed.');
                return response.json();
            })
            .then((data) => {
                feedbackItems = data && typeof data === 'object' ?
                    Object.entries(data).map(([id, item]) => ({...item, id })) : [];
                renderFeedback();
            })
            .catch(() => setFeedbackStatus('Shared database se connect nahi hua. Database URL aur access rules check karein.'));

        const eventSource = new EventSource(`${feedbackDatabaseUrl}/feedback.json`);
        eventSource.addEventListener('put', (event) => {
            try {
                const update = JSON.parse(event.data);
                if (update.path === '/') {
                    feedbackItems = update.data && typeof update.data === 'object' ?
                        Object.entries(update.data).map(([id, item]) => ({...item, id })) : [];
                } else if (update.path.startsWith('/')) {
                    const key = update.path.slice(1);
                    feedbackItems = feedbackItems.filter((item) => item.id !== key);
                    if (update.data) feedbackItems.push({...update.data, id: key });
                }
                renderFeedback();
                setFeedbackStatus('Live sync chalu hai. Naye feedback yahan turant dikhte hain.');
            } catch {
                setFeedbackStatus('Live update padhne mein dikkat hui.');
            }
        });
        eventSource.addEventListener('patch', (event) => {
            try {
                const update = JSON.parse(event.data);
                Object.entries(update.data || {}).forEach(([key, item]) => {
                    feedbackItems = feedbackItems.filter((savedItem) => savedItem.id !== key);
                    if (item) feedbackItems.push({...item, id: key });
                });
                renderFeedback();
            } catch {
                setFeedbackStatus('Live update padhne mein dikkat hui.');
            }
        });
        eventSource.onopen = () => setFeedbackStatus('Live sync chalu hai. Naye feedback yahan turant dikhte hain.');
        eventSource.onerror = () => setFeedbackStatus('Live connection dobara jodne ki koshish ho rahi hai.');
    } else if (feedbackList) {
        setFeedbackStatus('Local preview: is browser ka feedback yahan dikhega. Sabhi devices ke liye shared database configure karein.');
    }

    window.addEventListener('storage', (event) => {
        if (event.key === feedbackStorageKey) {
            feedbackItems = readLocalFeedback();
            renderFeedback();
        }
    });

    const hero = document.getElementById('hero');
    const subtitle = document.querySelector('.hero-subtitle');
    const serviceSearch = document.getElementById('serviceSearch');
    const serviceSearchCount = document.getElementById('serviceSearchCount');
    const serviceCards = document.querySelectorAll('#services .service-card');
    const noticeTrack = document.querySelector('.notice-track');
    const openStatus = document.getElementById('openStatus');
    const todayDateItems = document.querySelectorAll('.today-date');
    const calculatorInputs = ['printPages', 'scanPages', 'copyPages'].map((id) => document.getElementById(id));
    const calculatorTotal = document.getElementById('calculatorTotal');
    const adminNotice = document.getElementById('adminNotice');
    const adminService = document.getElementById('adminService');
    const adminPrice = document.getElementById('adminPrice');
    const saveAdminChanges = document.getElementById('saveAdminChanges');
    const resetAdminChanges = document.getElementById('resetAdminChanges');
    const adminMessage = document.getElementById('adminMessage');

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
    const servicesContainer = document.querySelector('.services-sections');

    if (servicesContainer && serviceCards.length) {
        const categories = [{
                name: 'Student Services',
                icon: '&#127891;',
                services: ['APAAR ID / ABC ID', 'Scholarship Apply', 'Competition Exam Forms', 'Entrance Exam Form', 'Resume / CV Making', 'Project Report Making', 'Job Application Services', 'College Admission Form', 'University Exam Form', 'Admit Card Download', 'Result & Marksheet Download', 'Scholarship Renewal & Correction', 'Assignment Typing', 'Online Counselling Registration', 'Internship & Apprenticeship Form']
            },
            {
                name: 'Government Documents',
                icon: '&#128220;',
                services: ['Aadhar Card Download', 'PAN Card Service', 'Voter ID Card', 'Birth Certificate', 'Residence Certificate', 'Income Certificate', 'Caste Certificate', 'DigiLocker Support', 'Ayushman Card', 'e-Shram Card', 'Driving Licence Services', 'Passport Appointment']
            },
            {
                name: 'Travel & Payments',
                icon: '&#128646;',
                services: ['Railway Ticket Booking', 'Flight Ticket Booking', 'Mobile Recharge', 'Electricity Bill Payment']
            },
            {
                name: 'Printing & Design',
                icon: '&#128424;',
                services: ['PVC Card Order', 'Online Form Printing', 'Photo & Signature Resize', 'YouTube Thumbnail Design']
            },
            {
                name: 'Business & Other Work',
                icon: '&#128187;',
                services: ['Website Development', 'Udyam / MSME Registration', 'ITR / GST Support', 'Cyber Cafe Services', 'All Online Work']
            }
        ];
        const cardsByTitle = new Map(Array.from(serviceCards, (card) => [card.querySelector('h3').textContent.trim(), card]));

        servicesContainer.replaceChildren();

        categories.forEach((category) => {
            const categorySection = document.createElement('section');
            const categoryTitle = document.createElement('h3');
            const categoryGrid = document.createElement('div');

            categorySection.className = 'service-category';
            categoryTitle.className = 'service-category-title';
            categoryTitle.innerHTML = `${category.icon} ${category.name}`;
            categoryGrid.className = 'services-grid';

            category.services.forEach((serviceName) => {
                const card = cardsByTitle.get(serviceName);

                if (card) {
                    categoryGrid.appendChild(card);
                }
            });

            categorySection.append(categoryTitle, categoryGrid);
            servicesContainer.appendChild(categorySection);
        });
    }

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

            serviceSearchCount.textContent = query ?
                `${visibleCount} service found` :
                'All services available';
        };

        serviceSearch.addEventListener('input', updateServiceSearch);
    }

    if (openStatus) {
        const updateOpenStatus = () => {
            const hour = new Date().getHours();
            const isOpen = hour >= 8 && hour < 21;

            openStatus.textContent = isOpen ?
                'Open Now - 8 AM to 9 PM' :
                'Closed Now - Opens at 8 AM';
            openStatus.classList.toggle('is-closed', !isOpen);
        };

        updateOpenStatus();
        window.setInterval(updateOpenStatus, 60000);
    }

    if (calculatorTotal && calculatorInputs.every(Boolean)) {
        const updateCalculator = () => {
            const [printPages, scanPages, copyPages] = calculatorInputs.map((input) => Math.max(0, Number(input.value) || 0));
            const total = (printPages * 10) + (scanPages * 5) + (copyPages * 2);
            calculatorTotal.textContent = `\u20b9${total.toLocaleString('en-IN')}`;
        };

        calculatorInputs.forEach((input) => input.addEventListener('input', updateCalculator));
        updateCalculator();
    }

    if (adminService && saveAdminChanges && resetAdminChanges) {
        const pricingRows = document.querySelectorAll('.pricing-table tbody tr');

        pricingRows.forEach((row) => {
            const serviceName = row.querySelector('th').textContent.trim();
            if (serviceName) {
                const option = document.createElement('option');
                option.value = serviceName;
                option.textContent = serviceName;
                adminService.appendChild(option);
            }
        });

        const savedNotice = localStorage.getItem('dsAdminNotice');
        const savedPrices = JSON.parse(localStorage.getItem('dsAdminPrices') || '{}');

        if (savedNotice && noticeTrack) {
            noticeTrack.querySelectorAll('span').forEach((item) => {
                item.textContent = savedNotice;
            });
        }

        Object.entries(savedPrices).forEach(([serviceName, price]) => {
            pricingRows.forEach((row) => {
                if (row.querySelector('th').textContent.trim() === serviceName) {
                    row.querySelector('td:last-child').textContent = price;
                }
            });
        });

        saveAdminChanges.addEventListener('click', () => {
            const serviceName = adminService.value;
            const price = adminPrice.value.trim();
            const notice = adminNotice.value.trim();
            const prices = JSON.parse(localStorage.getItem('dsAdminPrices') || '{}');

            if (serviceName && price) {
                prices[serviceName] = price;
                pricingRows.forEach((row) => {
                    if (row.querySelector('th').textContent.trim() === serviceName) {
                        row.querySelector('td:last-child').textContent = price;
                    }
                });
            }

            if (notice && noticeTrack) {
                localStorage.setItem('dsAdminNotice', notice);
                noticeTrack.querySelectorAll('span').forEach((item) => {
                    item.textContent = notice;
                });
            }

            localStorage.setItem('dsAdminPrices', JSON.stringify(prices));
            adminMessage.textContent = 'Changes saved on this browser.';
        });

        resetAdminChanges.addEventListener('click', () => {
            localStorage.removeItem('dsAdminNotice');
            localStorage.removeItem('dsAdminPrices');
            window.location.reload();
        });
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