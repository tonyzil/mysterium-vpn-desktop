/**
 * Replaces the node binaries from @mysteriumnetwork/node, whose npm releases stop at 1.29.20,
 * with a newer GitHub release, and installs the patched DNS script.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { createHash } = require("crypto")
const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const NODE_VERSION = "1.39.9"
const TARBALL = "myst_darwin_arm64.tar.gz"
const TARBALL_SHA256 = "29b73b6aec32ba83cd8ea3a7e9246e49678dca66aacb2c58772a5f67b635aafe"

const packageDir = path.resolve(__dirname, "../node_modules/@mysteriumnetwork/node")
const binDir = path.join(packageDir, "bin/mac/arm64")
const packageJsonPath = path.join(packageDir, "package.json")

const main = async () => {
    // shortcut: Apple Silicon Macs only, other platforms keep the npm node; add their tarballs to build there.
    if (process.platform !== "darwin" || process.arch !== "arm64") {
        console.log(`Keeping the npm node on ${process.platform}/${process.arch}`)
        return
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
    if (packageJson.version !== NODE_VERSION) {
        const url = `https://github.com/mysteriumnetwork/node/releases/download/${NODE_VERSION}/${TARBALL}`
        const res = await fetch(url)
        if (!res.ok) {
            throw new Error(`Download failed: ${res.status} ${url}`)
        }
        const tarball = Buffer.from(await res.arrayBuffer())
        const sha256 = createHash("sha256").update(tarball).digest("hex")
        if (sha256 !== TARBALL_SHA256) {
            throw new Error(`Checksum mismatch for ${TARBALL}: ${sha256}`)
        }
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myst-"))
        const tarballPath = path.join(tmpDir, TARBALL)
        fs.writeFileSync(tarballPath, tarball)
        execFileSync("tar", ["xzf", tarballPath, "-C", binDir])
        fs.rmSync(tmpDir, { recursive: true })

        // nodeVersion() reads this, and the app compares it with the running supervisor to upgrade it.
        packageJson.version = NODE_VERSION
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
    }

    fs.copyFileSync(path.join(__dirname, "update-resolv-conf"), path.join(binDir, "config/update-resolv-conf"))
    fs.chmodSync(path.join(binDir, "config/update-resolv-conf"), 0o755)
    console.log(`Using Mysterium node ${NODE_VERSION}`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
