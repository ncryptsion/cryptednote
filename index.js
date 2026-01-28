(async()=>{
    "use strict";

    // Dependencies
    const client = await require("./modules/mongodb.js")
    const { rateLimit } = require("express-rate-limit")
    const simpleAES256 = require("simple-aes-256")
    const cookieParser = require("cookie-parser")
    const compression = require("compression")
    const { parse } = require("smol-toml")
    const express = require("express")
    const hashJS = require("hash.js")
    const helmet = require("helmet")
    const cryptr = require("cryptr")
    const path = require("path")
    const fs = require("fs")

    // Variables
    const settings = parse(fs.readFileSync(path.join(__dirname, "settings.toml"), "utf8"))
    const web = express()
    const port = process.env.PORT || 8080

    const limiter = rateLimit({
        windowMs: 10 * 60 * 1000, // 10 Minutes
        limit: 300,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        ipv6Subnet: 56
    })

    const db = client.db(settings.database.databaseName)
    const pads = db.collection(settings.database.collectionName)

    const cT = new cryptr(settings.security.cookieMasterKey, { encoding: "hex", pbkdf2Iterations: settings.security.cookiePBKDF2Iterations, saltLength: settings.security.saltLength })

    // Functions
    const SHA512 = (string)=>{return hashJS.sha512().update(string).digest("hex")}
    const setCookie = (res, data)=>{
        res.cookie("d", data, {
            maxAge: 30 * 60 * 1000, // 30 Minutes
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        })
    }

    const dS = async(session)=>{
        try{
            const sessionData = JSON.parse(cT.decrypt(session.d))
            return sessionData
        }catch{return false}
    }

    // Configurations
    //* Express
    web.use(limiter)
    web.use(helmet.xssFilter(), helmet.xDnsPrefetchControl(), helmet.xXssProtection(), helmet.hidePoweredBy(), helmet.frameguard({ action: "deny" }), helmet.noSniff(), helmet.hsts(), helmet.referrerPolicy())
    web.set("trust proxy", 1)
    web.use(cookieParser())
    web.use(compression({ level: 1 }))
    web.use(express.json({ limit: "15mb" }))

    // Main
    web.use((req, res, next)=>{
        if(req.path.match(".html")) return res.redirect(req.path.replace(".html", ""))
        next()
    })

    web.get("/note", async(req, res, next)=>{
        if(!(await dS(req.cookies))) return res.redirect("/")
        next()
    })

    web.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }))

    web.get("/api/cc", async(req, res)=>{
        res.clearCookie("d")
        res.redirect("/")
    })

    web.post("/api/open-pad", async(req, res)=>{
        var { primaryKey, code, password, location } = req.body
        const realPassword = `${primaryKey}${code}${password}`
        primaryKey = SHA512(primaryKey); code = SHA512(code); password = SHA512(password); location = SHA512(location)
        location = `${primaryKey}${code}${location}`

        const data = await pads.findOne({ location: location })

        if(!data) await pads.insertOne({ location: location, content: "" })

        const cookieData = {
            location: location,
            password: realPassword
        }

        setCookie(res, cT.encrypt(JSON.stringify(cookieData)))
        res.send("success")
    })

    web.post("/api/save-pad", async(req, res)=>{
        if(!(await dS(req.cookies))) return res.send("failed")
        const { content } = req.body
        var cookieData = await dS(req.cookies)
        const data = await pads.findOne({ location: cookieData.location })

        if(content.length > 100000) return res.send("0") // Max of content that can be stored is 100k characters.

        if(data){
            await pads.updateOne({ location: cookieData.location }, {
                $set: {
                    content: simpleAES256.encrypt(cookieData.password, content).toString("hex")
                }
            })
        }else{
            return res.redirect("/")
        }

        res.send("success")
    })

     web.get("/api/nuke-pad", async(req, res)=>{
        if(!(await dS(req.cookies))) return res.redirect("/")
        var cookieData = await dS(req.cookies)
        const data = await pads.findOne({ location: cookieData.location })

        if(data) await pads.deleteOne({ location: cookieData.location })
        res.clearCookie("d").redirect("/")
    })

    web.get("/api/view-pad", async(req, res)=>{
        if(!(await dS(req.cookies))) return res.send("failed")
        var cookieData = await dS(req.cookies)
        const data = await pads.findOne({ location: cookieData.location })

        if(data){
            if(data.content){
                res.send(simpleAES256.decrypt(cookieData.password, Buffer.from(data.content, "hex")))
            }else{
                res.send("This pad is empty.")
            }
        }else{
            return res.redirect("/")
        }
    })

    web.use("/{*any}", (req, res)=>res.redirect("/"))
    web.listen(settings.web.port, ()=>console.log(`Server is running. Port: ${port}`))
})()