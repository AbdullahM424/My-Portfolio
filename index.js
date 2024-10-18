document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.animated');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    elements.forEach(element => {
        observer.observe(element);
    });
});

window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.backgroundColor = '#fff'; // Change to bright color
        navbar.style.color = '#000'; // Adjust text/icon color if needed
    } else {
        navbar.style.backgroundColor = '#333'; // Original color
        navbar.style.color = '#fff'; // Original text/icon color
    }
});

