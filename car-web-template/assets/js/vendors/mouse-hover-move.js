! function(e) {
    e.fn.mouseHover = function() {
        var parent = jQuery(this);
        Array.from(parent).forEach(element => {
            if (element) {
                element.insertAdjacentHTML('beforeend', '<span class="target"></span>')
                const links = element.querySelectorAll(".hover-effect");
                const target = element.querySelector(".target");

                function resetTargetPosition() {
                    if (target) {
                        target.style.transform = "none";
                        const activeLink = element.querySelector(".nav-link.active");
                        if (activeLink) {
                            const width = activeLink.offsetWidth;
                            const height = activeLink.offsetHeight;
                            const left = activeLink.offsetLeft;
                            const top = activeLink.offsetTop;
                            const radius = getComputedStyle(activeLink);
                            target.style.width = `${width}px`;
                            target.style.height = `${height}px`;
                            target.style.left = `${left}px`;
                            target.style.top = `${top}px`;
                            target.style.borderRadius = radius.getPropertyValue('border-radius');
                            const navItems = element.querySelectorAll(".nav-item");
                            for (let i = 0; i < navItems.length; i++) {
                                navItems[i].classList.remove("active");
                            }
                            activeLink.parentNode.classList.add("active");
                        }
                    }
                }

                function mouseenterFunc() {
                    const width = this.offsetWidth;
                    const height = this.offsetHeight;
                    const left = this.offsetLeft;
                    const top = this.offsetTop;
                    const radius = getComputedStyle(this);
                    target.style.width = `${width}px`;
                    target.style.height = `${height}px`;
                    target.style.left = `${left}px`;
                    target.style.top = `${top}px`;
                    target.style.transform = "none";
                    target.style.borderRadius = radius.getPropertyValue('border-radius');
                    if (!this.parentNode.classList.contains("active")) {
                        for (let i = 0; i < links.length; i++) {
                            if (links[i].parentNode.classList.contains("active")) {
                                links[i].parentNode.classList.remove("active");
                            }
                        }
                        this.parentNode.classList.add("active");
                    }
                }
                for (let i = 0; i < links.length; i++) {
                    links[i].addEventListener("click", (e) => e.preventDefault());
                    links[i].addEventListener("mouseenter", mouseenterFunc);
                    links[i].addEventListener("click", mouseenterFunc);
                }

                element.addEventListener("mouseleave", resetTargetPosition);
            }
        });
    }
}(jQuery);
