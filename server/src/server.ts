import * as http from "http"
import * as fs from "fs"
import * as path from "path"
import * as httpStatus from "http-status-codes"

/************************************************************* Constants ************************************************************/

// maps file extention to MIME types
// full list can be found here: https://www.freeformatter.com/mime-types-list.html
const ext2mime: { [index: string]: string | undefined } = {
    ".ico": "image/x-icon",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".eot": "application/vnd.ms-fontobject",
    ".ttf": "application/x-font-ttf",
}
const ext2mimeDefault: string = "text/plain"

// Root directory for app
const approot: string = path.resolve("public")  // Absolute path to publicly accessible files

// Store location of error pages
const status2filepath: { [index: number]: string | undefined } = {}
status2filepath[httpStatus.FORBIDDEN] = path.resolve(approot, "errors/Forbidden.html")
status2filepath[httpStatus.NOT_FOUND] = path.resolve(approot, "errors/NotFound.html")

/************************************************************** Helpers *************************************************************/

/**
 * Write status code into response, along with some contents from an error page if one exists
 * 
 * @param response
 * @param statusCode 
 */
function respondWithError(response: http.ServerResponse, statusCode: number): void {
    const filepath: string | undefined = status2filepath[statusCode]
    response.statusCode = statusCode
    if (filepath) {
        const contents: Buffer = fs.readFileSync(filepath)
        response.setHeader("Content-type", ext2mime[".html"] || ext2mimeDefault)
        response.end(contents)
    } else {
        response.setHeader("Content-type", ext2mimeDefault)
        response.end(`${statusCode} ${httpStatus.getReasonPhrase(statusCode)}`)
    }
}

/**
 * Handle GET requests by serving files in approot
 * 
 * @param request
 * @param response
 */
function getHandler(request: http.IncomingMessage, response: http.ServerResponse): void {
    // Default to index.html
    request.url = request.url || "/index.html"
    let filepath: string = path.resolve(path.join(approot, request.url))
    if (filepath === approot) {
        filepath = path.resolve(approot, "index.html")
    }
    const relpath: string = path.relative(approot, filepath)
    const ext: string = path.parse(filepath).ext

    if (relpath.substring(0, 3) === ".." + path.sep) {
        // Deny paths that leave the app root directory
        // https://en.wikipedia.org/wiki/Directory_traversal_attack
        respondWithError(response, httpStatus.FORBIDDEN)
        console.log(`Denied access to '${request.url}' because it is a relative path`)
    } else if (fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
        // Read and return the file if it exists
        try {
            const contents: Buffer = fs.readFileSync(filepath)
            response.statusCode = httpStatus.OK
            response.setHeader("Content-type", ext2mime[ext] || ext2mimeDefault)
            response.end(contents)
            console.log(`Served '${filepath}' succesfully`)
        } catch {
            respondWithError(response, httpStatus.INTERNAL_SERVER_ERROR)
            console.log(`Error getting file '${filepath}'`)
        }
    } else {
        respondWithError(response, httpStatus.NOT_FOUND)
        console.log(`File '${filepath}' does not exist`)
    }
}

/************************************************************** Server **************************************************************/

const server: http.Server = http.createServer()

server.on("request", (request: http.IncomingMessage, response: http.ServerResponse) => {
    console.log(`${request.method} request for '${request.url}'`)

    if (request.method !== "GET") {
        respondWithError(response, httpStatus.NOT_IMPLEMENTED)
    } else {
        getHandler(request, response)
    }
})

server.listen(8080)