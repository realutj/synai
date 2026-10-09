import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import path from "node:path";

type ReleasePlatform = "macos" | "windows" | "linux";

const [platformValue, target] = process.argv.slice(2);
if (
	platformValue !== "macos" &&
	platformValue !== "windows" &&
	platformValue !== "linux"
) {
	throw new Error("usage: collect-desktop-release-artifacts.ts <macos|windows|linux> [rust-target]");
}
const platform: ReleasePlatform = platformValue;

const appRoot = path.resolve(import.meta.dir, "..");
const targetRoot = path.join(
	appRoot,
	"src-tauri",
	"target",
	...(target ? [target] : []),
	"release",
	"bundle",
);
const outputRoot = path.join(appRoot, "dist", "desktop-release");

const bundleDirectories: Record<ReleasePlatform, string[]> = {
	macos: ["dmg", "macos"],
	windows: ["nsis"],
	linux: ["appimage", "deb"],
};

const matchesPlatform = (fileName: string): boolean => {
	if (platform === "macos") {
		return (
			fileName.endsWith(".dmg") ||
			fileName.endsWith(".app.tar.gz") ||
			fileName.endsWith(".app.tar.gz.sig")
		);
	}
	if (platform === "windows") {
		return /-setup\.exe(?:\.sig)?$/i.test(fileName);
	}
	return /\.appimage$/i.test(fileName) || /\.deb$/i.test(fileName);
};

const collected: string[] = [];
const walk = (directory: string): void => {
	if (!existsSync(directory)) {
		return;
	}
	for (const entry of readdirSync(directory)) {
		const source = path.join(directory, entry);
		if (statSync(source).isDirectory()) {
			walk(source);
			continue;
		}
		if (!matchesPlatform(entry)) {
			continue;
		}
		const destination = path.join(outputRoot, entry);
		if (existsSync(destination)) {
			throw new Error("duplicate release asset name: " + entry);
		}
		cpSync(source, destination);
		collected.push(entry);
	}
};

rmSync(outputRoot, { force: true, recursive: true });
mkdirSync(outputRoot, { recursive: true });
for (const directory of bundleDirectories[platform]) {
	walk(path.join(targetRoot, directory));
}

const requiredPatterns: Record<ReleasePlatform, RegExp[]> = {
	macos: [
		/\.dmg$/i,
		/\.app\.tar\.gz$/i,
		/\.app\.tar\.gz\.sig$/i,
	],
	windows: [/-setup\.exe$/i, /-setup\.exe\.sig$/i],
	linux: [/\.appimage$/i, /\.deb$/i],
};
for (const pattern of requiredPatterns[platform]) {
	if (!collected.some((fileName) => pattern.test(fileName))) {
		throw new Error(
			"missing " +
				platform +
				" release asset matching " +
				pattern +
				" under " +
				targetRoot,
		);
	}
}

console.log("Collected " + collected.length + " " + platform + " release assets:");
for (const fileName of collected.sort()) {
	console.log("- " + fileName);
}
