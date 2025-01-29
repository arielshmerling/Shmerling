

(function () {
    const forms = document.querySelectorAll(".validated-form");
    Array.from(forms)
        .forEach(function (form) {
            form.addEventListener("submit", function (event) {
                if (!form.checkValidity()) {
                    event.preventDefault();
                    event.stopPropogation();
                }
                form.classList.add("validated");
            }, false);
        });
}) ();


