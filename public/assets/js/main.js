// Variables
const unlockPad = document.getElementById("unlock-note")
const savePad = document.getElementById("save-pad")
const nukePad = document.getElementById("nuke-pad")
const exitPad = document.getElementById("exit-pad")

// Functions
const loadPadContent = async()=>{
    var response = await fetch("/api/view-pad", {
        method: "GET"
    })
    response = await response.text()
    if(response === "failed") return document.getElementById("note").value = "Failed to load."

    document.getElementById("note").value = response
}

// Main
if(window.location.pathname === "/"){
    unlockPad.addEventListener("click", async()=>{
        const primaryKey = document.getElementById("primary-key").value
        const code = document.getElementById("code").value
        const password = document.getElementById("password").value
        const location = document.getElementById("location").value

        var response = await fetch("/api/open-pad", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                accept: "text/plain"
            },
            body: JSON.stringify({
                primaryKey,
                code,
                password,
                location
            })
        })
        response = await response.text()
        if(response === "success") window.location.href = "/note"
    })
}
if(window.location.pathname === "/note"){
    loadPadContent()

    savePad.addEventListener("click", async()=>{
        const content = document.getElementById("note").value
        const message = document.getElementById("message")

        var response = await fetch("/api/save-pad", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                accept: "text/plain"
            },
            body: JSON.stringify({ content })
        })
        response = await response.text()
        if(response === "success"){
            message.textContent = "Saved!"
            setTimeout(()=>{message.textContent = ""}, 2 * 1000)
        }else if(response === "0"){
            message.textContent = "Max content is 100,000 characters."
            setTimeout(()=>{message.textContent = ""}, 4 * 1000)
        }else{
            message.textContent = "Unable to Save!"
            setTimeout(()=>{message.textContent = ""}, 2 * 1000)
        }
    })

    nukePad.addEventListener("click", async()=>{
        window.location.href = "/api/nuke-pad"
    })

    exitPad.addEventListener("click", async()=>{
        window.location.href = "/api/cc"
    })
}