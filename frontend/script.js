async function login() {

    const name =
    document.getElementById("name").value;

    const password =
    document.getElementById("password").value;

    const response = await fetch(
        "http://localhost:3000/login",
        {
            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({
                name,
                password
            })
        }
    );

    const data = await response.json();

    console.log(data);

    if(data.success){

        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );

        if(data.user.role === "admin"){

            window.location.href =
            "admin.html";

        }else{

            window.location.href =
            "staff.html";

        }

    }else{

        document.getElementById("message")
        .innerText = "Invalid Login";

    }

}
