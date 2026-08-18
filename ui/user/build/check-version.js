/**
 * The contents of this file are subject to the terms of the Common Development and
 * Distribution License (the License). You may not use this file except in compliance with the
 * License.
 *
 * You can obtain a copy of the License at legal/CDDLv1.0.txt. See the License for the
 * specific language governing permission and limitations under the License.
 *
 * When distributing Covered Software, include this CDDL Header Notice in each file and include
 * the License file at legal/CDDLv1.0.txt. If applicable, add the following below the CDDL
 * Header, with the fields enclosed by brackets [] replaced by your own identifying
 * information: "Portions copyright [year] [name of copyright owner]".
 *
 * Portions copyright 2026 3A Systems, LLC.
 */

/*
 * Fail the build when this module's package.json has drifted from Maven's ${project.version}.
 *
 * npm derives the tarball filename from package.json; build-helper-maven-plugin derives the
 * path it attaches from ${project.version}. On drift the two name different files and the
 * build fails at `install` with an ArtifactInstallerException that says nothing about a
 * version mismatch. Run by frontend-maven-plugin at `initialize` with PROJECT_VERSION set.
 *
 * Two things are checked, because two things drift:
 *   - this module's own `version`, which names the tarball;
 *   - any @openidentityplatform/* peer range, which is an exact pin rather than a range
 *     because both ui modules are built from one reactor at one ${project.version} and are
 *     released together. That pin ships inside the tarball and is declared optional, so a
 *     stale one resolves silently into a tree without the peer instead of failing loudly.
 *     Task 3.12 replaces it with a registry range, at which point this loop stops applying.
 */
var pkg = require("../package.json");
var want = process.env.PROJECT_VERSION;
var problems = [];

if (!want) {
    console.error("[check-version] PROJECT_VERSION is not set - this script expects to be run "
        + "by frontend-maven-plugin with <environmentVariables><PROJECT_VERSION>");
    process.exit(1);
}

if (pkg.version !== want) {
    problems.push("package.json version " + pkg.version + " != project.version " + want);
}

var peers = pkg.peerDependencies || {};
Object.keys(peers).filter(function (name) {
    return name.indexOf("@openidentityplatform/") === 0;
}).forEach(function (name) {
    if (peers[name] !== want) {
        problems.push("peerDependencies[\"" + name + "\"] pinned at " + peers[name]
            + " != project.version " + want);
    }
});

if (problems.length) {
    problems.forEach(function (p) {
        console.error("[check-version] " + p);
    });
    process.exit(1);
}
