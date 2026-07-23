/*-----------------------------------------------------------
    * Template Name    : Furious - Car Listing HTML Template
    * Author           : KreativDev
    * File Description : This file contains the javaScript functions for the actual template, this
                        is the file you need to edit to change the functionality of the template.
    *------------------------------------------------------------ 
*/

!(function($) {
    "use strict";

    /*============================================
        Mobile menu
    ============================================*/
    var mobileMenu = function() {
        // Variables
        var body = $("body"),
            mainNavbar = $(".main-navbar"),
            mobileNavbar = $(".mobile-menu"),
            cloneInto = $(".mobile-menu-wrapper"),
            cloneItem = $(".mobile-item"),
            menuToggler = $(".menu-toggler"),
            offCanvasMenu = $("#offcanvasMenu"),
            backdrop,
            _initializeBackDrop = function() {
                backdrop = document.createElement('div');
                backdrop.className = 'menu-backdrop';
                backdrop.onclick = function hideOffCanvas() {
                    menuToggler.removeClass("active"),
                        body.removeClass("mobile-menu-active"),
                        backdrop.remove();
                };
                document.body.appendChild(backdrop);
            };

        menuToggler.on("click", function() {
            $(this).toggleClass("active");
            body.toggleClass("mobile-menu-active");
            _initializeBackDrop();
            if (!body.hasClass("mobile-menu-active")) {
                $('.menu-backdrop').remove();
            }
        })

        mainNavbar.find(cloneItem).clone(!0).appendTo(cloneInto);

        if (offCanvasMenu) {
            body.find(offCanvasMenu).clone(!0).appendTo(cloneInto);
        }

        mobileNavbar.find("li").each(function(index) {
            var toggleBtn = $(this).children(".toggle")
            toggleBtn.on("click", function(e) {
                $(this)
                    .parent("li")
                    .children("ul")
                    .stop(true, true)
                    .slideToggle(350);
                $(this).parent("li").toggleClass("show");
            })
        })

        // check browser width in real-time
        var checkBreakpoint = function() {
            var winWidth = window.innerWidth;
            if (winWidth <= 1199) {
                mainNavbar.hide();
                mobileNavbar.show()
            } else {
                mainNavbar.show();
                mobileNavbar.hide();
                $('.menu-backdrop').remove();
            }
        }
        checkBreakpoint();

        $(window).on('resize', function() {
            checkBreakpoint();
        });
    }
    mobileMenu();


    /*============================================
        Navlink active class
    ============================================*/
    var a = $("#mainMenu .nav-link"),
        c = window.location;
    for (var i = 0; i < a.length; i++) {
        const el = a[i];

        if (el.href == c) {
            el.classList.add("active");
        }
    }


    /*============================================
        Sticky header
    ============================================*/
    $(window).on("scroll", function() {
        var header = $(".header-area");
        // If window scroll down .is-sticky class will added to header
        if ($(window).scrollTop() >= 100) {
            header.addClass("is-sticky");
        } else {
            header.removeClass("is-sticky");
        }
    });


    /*============================================
        Password icon toggle
    ============================================*/
    $(".show-password-field").on("click", function() {
        var showIcon = $(this).children(".show-icon");
        var passwordField = $(this).prev("input");
        showIcon.toggleClass("show");
        if (passwordField.attr("type") == "password") {
            passwordField.attr("type", "text")
        } else {
            passwordField.attr("type", "password");
        }
    })


    /*============================================
        Image to background image
    ============================================*/
    var bgImage = $(".bg-img")
    bgImage.each(function() {
        var el = $(this),
            src = el.attr("data-bg-image");

        el.css({
            "background-image": "url(" + src + ")",
            "background-position": "center",
            "display": "block"
        });
    });


    /*============================================
        Price range
    ============================================*/
    var sliders = document.querySelectorAll("[data-range-slider='priceSlider']");
    var filterSliders = document.querySelector("[data-range-slider='filterPriceSlider']");
    var input0 = document.getElementById('min');
    var input1 = document.getElementById('max');
    var inputs = [input0, input1];
    // Home price slider
    for (let i = 0; i < sliders.length; i++) {
        const el = sliders[i];

        noUiSlider.create(el, {
            start: [200, 500],
            connect: !0,
            step: 10,
            margin: 10,
            range: {
                min: 0,
                max: 1000
            }
        }), el.noUiSlider.on("update", function(values) {
            $("[data-range-value='priceSliderValue']").text("$" + values.join(" - " + "$"));
        })
    }
    // Filter frice slider
    if (filterSliders) {
        noUiSlider.create(filterSliders, {
            start: [200, 500],
            connect: !0,
            step: 10,
            margin: 10,
            range: {
                min: 10,
                max: 1000
            }
        }), filterSliders.noUiSlider.on("update", function(values, handle) {
            $("[data-range-value='filterPriceSliderValue']").text("$" + values.join(" - " + "$"));

            inputs[handle].value = values[handle];
        })

        inputs.forEach(function(input, handle) {
            if (input) {
                input.addEventListener('change', function() {
                    filterSliders.noUiSlider.setHandle(handle, this.value);
                });
            }
        });
    }


    /*============================================
        Tabs mouse hover animation
    ============================================*/
    $("[data-hover='fancyHover']").mouseHover();


    /*============================================
        Sliders
    ============================================*/
    // Home Slider 1
    var homeSlider1 = new Swiper("#home-slider-1", {
        loop: true,
        speed: 1000,
        grabCursor: true,
        parallax: true,
        slidesPerView: 1,

        // Navigation arrows
        navigation: {
            nextEl: '#home-slider-1-next',
            prevEl: '#home-slider-1-prev',
        },

        pagination: {
            el: '#home-slider-1-pagination',
            clickable: false,
            renderBullet: function(index, className) {
                return '<span class="' + className + '">' + "0" + (index + 1) + "</span>";
            },
        },
    });
    var homeImageSlider1 = new Swiper("#home-img-slider-1", {
        loop: true,
        speed: 1000,
        grabCursor: true,
        slidesPerView: 1
    });
    // Sync both slider
    homeImageSlider1.controller.control = homeSlider1;
    homeSlider1.controller.control = homeImageSlider1;

    // Home Slider 2
    var homeSlider2 = new Swiper("#home-slider-2", {
        loop: true,
        speed: 1000,
        slidesPerView: 1,
        effect: "fade",
        fadeEffect: {
            crossFade: true
        },
        allowTouchMove: false
    });
    var homeImageSlider2 = new Swiper("#home-img-slider-2", {
        loop: true,
        speed: 1000,
        grabCursor: true,
        slidesPerView: 1,
        autoplay: true,
        pagination: {
            el: "#home-img-slider-2-pagination",
            clickable: true,
        },
    });
    // Sync both slider
    homeImageSlider2.controller.control = homeSlider2;

    // Home Slider 3
    var homeSlider3 = new Swiper("#home-slider-3", {
        loop: true,
        speed: 1000,
        slidesPerView: 1,
        effect: "fade",
        fadeEffect: {
            crossFade: true
        },
        allowTouchMove: false
    });
    var homeImageSlider3 = new Swiper("#home-img-slider-3", {
        loop: true,
        speed: 1000,
        grabCursor: true,
        slidesPerView: 1,
        autoplay: true,
        pagination: {
            el: "#home-img-slider-3-pagination",
            clickable: true,
        },
    });
    // Sync both slider
    homeImageSlider3.controller.control = homeSlider3;

    // Testimonial Slider
    var testimonialSlider1 = new Swiper("#testimonial-slider-1", {
        speed: 400,
        spaceBetween: 25,
        loop: true,
        slidesPerView: 2,

        // Navigation arrows
        navigation: {
            nextEl: '#testimonial-slider-btn-next',
            prevEl: '#testimonial-slider-btn-prev',
        },

        breakpoints: {
            // when window width is >= 320px
            320: {
                slidesPerView: 1
            },
            // when window width is >= 400px
            992: {
                slidesPerView: 2
            }
        }
    });
    var testimonialSlider2 = new Swiper("#testimonial-slider-2", {
        speed: 400,
        spaceBetween: 25,
        loop: true,
        slidesPerView: 1,
        pagination: {
            el: "#testimonial-slider-2-pagination",
            clickable: true,
        },
    });

    // Shop single slider
    var proSingleThumb = new Swiper(".slider-thumbnails", {
        loop: true,
        speed: 1000,
        spaceBetween: 20,
        slidesPerView: 3,
        breakpoints: {
            0: {
                slidesPerView: 3,
                spaceBetween: 15,
            },
            576: {
                slidesPerView: 4,
                spaceBetween: 15,
            },
            992: {
                slidesPerView: 3,
                spaceBetween: 20,
            },
        }
    });
    var proSingleSlider = new Swiper(".product-single-slider", {
        loop: true,
        speed: 1000,
        autoplay: {
            delay: 3000
        },
        watchSlidesProgress: true,
        thumbs: {
            swiper: proSingleThumb,
        },

        // Navigation arrows
        navigation: {
            nextEl: ".slider-btn-next",
            prevEl: ".slider-btn-prev",
        },
    });

    // Category Slider
    $(".category-slider").each(function() {
        var id = $(this).attr("id");
        var sliderId = "#" + id;

        var swiper = new Swiper(sliderId, {
            speed: 400,
            spaceBetween: 25,
            loop: true,
            slidesPerView: 3,

            // Navigation arrows
            navigation: {
                nextEl: sliderId + "-next",
                prevEl: sliderId + "-prev",
            },

            breakpoints: {
                320: {
                    slidesPerView: 1
                },
                576: {
                    slidesPerView: 3
                },
            }
        })
    })
    var catSlider2 = new Swiper(".category-slider-2", {
        speed: 400,
        spaceBetween: 25,
        loop: true,
        slidesPerView: 3,

        // Navigation arrows
        navigation: {
            nextEl: "#category-slider-2-next",
            prevEl: "#category-slider-2-prev",
        },

        breakpoints: {
            320: {
                slidesPerView: 1
            },
            576: {
                slidesPerView: 3
            },
            992: {
                slidesPerView: 2
            },
            1440: {
                slidesPerView: 3
            },
        }
    })

    // Product Slider
    $(".product-slider").each(function() {
        var id = $(this).attr("id");
        var sliderId = "#" + id;

        var swiper = new Swiper(sliderId, {
            speed: 400,
            spaceBetween: 25,
            loop: true,
            slidesPerView: 3,

            // Navigation arrows
            navigation: {
                nextEl: sliderId + "-next",
                prevEl: sliderId + "-prev",
            },

            breakpoints: {
                320: {
                    slidesPerView: 1
                },
                768: {
                    slidesPerView: 2
                },
                1200: {
                    slidesPerView: 3
                },
            }
        })
    })

    // Shop single slider
    var shopSingleThumb = new Swiper(".shop-thumbnails", {
        loop: true,
        speed: 1000,
        spaceBetween: 20,
        slidesPerView: 4,
        centerSlide: true
    });
    var shopSingleSlider = new Swiper(".shop-details-slider", {
        loop: true,
        speed: 1000,
        autoplay: {
            delay: 3000
        },
        watchSlidesProgress: true,
        thumbs: {
            swiper: shopSingleThumb,
        },

        // Navigation arrows
        navigation: {
            nextEl: ".slider-btn-next",
            prevEl: ".slider-btn-prev",
        },
    });

    // Shop Slider
    var swiper = new Swiper(".shop-slider", {
        speed: 400,
        spaceBetween: 25,
        loop: true,
        slidesPerView: 4,

        // Navigation arrows
        navigation: {
            nextEl: "#shop-slider-next",
            prevEl: "#shop-slider-prev",
        },

        breakpoints: {
            320: {
                slidesPerView: 1
            },
            576: {
                slidesPerView: 2
            },
            992: {
                slidesPerView: 3
            },
            1200: {
                slidesPerView: 4
            },
        }
    })


    /*============================================
        Countdown Timer
    ============================================*/
    function makeTimer() {
        var endTime = new Date("May 20, 2024 17:00:00 PDT");
        var endTime = (Date.parse(endTime)) / 1000;
        var now = new Date();
        var now = (Date.parse(now) / 1000);
        var timeLeft = endTime - now;
        var days = Math.floor(timeLeft / 86400);
        var hours = Math.floor((timeLeft - (days * 86400)) / 3600);
        var minutes = Math.floor((timeLeft - (days * 86400) - (hours * 3600)) / 60);
        var seconds = Math.floor((timeLeft - (days * 86400) - (hours * 3600) - (minutes * 60)));
        if (hours < "10") {
            hours = "0" + hours;
        }
        if (minutes < "10") {
            minutes = "0" + minutes;
        }
        if (seconds < "10") {
            seconds = "0" + seconds;
        }
        $("#days .time").html(days);
        $("#hours .time").html(hours);
        $("#minutes .time").html(minutes);
        $("#seconds .time").html(seconds);
    }
    setInterval(function() {
        makeTimer()
    }, 0);


    /*============================================
        Quantity Button
    ============================================*/
    $(document).on("click", ".qty-down", function() {
        var numProduct = Number($(this).next().val());
        if (numProduct > 0) $(this).next().val(numProduct - 1);
    });
    $(document).on("click", ".qty-up", function() {
        var numProduct = Number($(this).prev().val());
        $(this).prev().val(numProduct + 1);
    });


    /*============================================
        Product single popup
    ============================================*/
    $(".lightbox-single").magnificPopup({
        type: "image",
        mainClass: 'mfp-with-zoom',
        gallery: {
            enabled: true
        }
    });


    /*============================================
        Youtube popup
    ============================================*/
    $(".youtube-popup").magnificPopup({
        disableOn: 300,
        type: "iframe",
        mainClass: "mfp-fade",
        removalDelay: 160,
        preloader: false,
        fixedContentPos: false
    })


    /*============================================
        Go to top
    ============================================*/
    $(window).on("scroll", function() {
        // If window scroll down .active class will added to go-top
        var goTop = $(".go-top");

        if ($(window).scrollTop() >= 200) {
            goTop.addClass("active");
        } else {
            goTop.removeClass("active")
        }
    })
    $(".go-top").on("click", function(e) {
        $("html, body").animate({
            scrollTop: 0,
        }, 0);
    });


    /*============================================
        Lazyload image
    ============================================*/
    var lazyLoad = function() {
        window.lazySizesConfig = window.lazySizesConfig || {};
        window.lazySizesConfig.loadMode = 2;
        lazySizesConfig.preloadAfterLoad = true;
    }


    /*============================================
        Odometer
    ============================================*/
    $(".counter").counterUp({
        delay: 10,
        time: 1000
    });


    /*============================================
        Nice select
    ============================================*/
    $(".nice-select").niceSelect();

    var selectList = $(".nice-select .list")
    $(".nice-select .list").each(function() {
        var list = $(this).children();
        if (list.length > 5) {
            $(this).css({
                "height": "160px",
                "overflow-y": "scroll"
            })
        }
    })


    /*============================================
        Sidebar scroll
    ============================================*/
    $(document).ready(function() {
        $(".widget").each(function() {
            var child = $(this).find(".accordion-body.scroll-y");
            if (child.height() >= 245) {
                child.css({
                    "padding-inline-end": "10px",
                })
            }
        })
    })


    /*============================================
        Tooltip
    ============================================*/
    var tooltipTriggerList = [].slice.call($('[data-tooltip="tooltip"]'))

    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })


    /*============================================
        Footer date
    ============================================*/
    var date = new Date().getFullYear();
    $("#footerDate").text(date);


    /*============================================
        Document on ready
    ============================================*/
    $(document).ready(function() {
        lazyLoad()
    })

})(jQuery);

$(window).on("load", function() {
    const delay = 350;

    /*============================================
    Preloader
    ============================================*/
    $("#preLoader").delay(delay).fadeOut('slow');

    /*============================================
        Aos animation
    ============================================*/
    var aosAnimation = function() {
        AOS.init({
            easing: "ease",
            duration: 1500,
            once: true,
            offset: 60,
            disable: 'mobile'
        });
    }
    if ($("#preLoader")) {
        setTimeout(() => {
            aosAnimation()
        }, delay);
    } else {
        aosAnimation();
    }
})