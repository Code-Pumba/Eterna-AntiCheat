//@ts-check

import { stat, readdir, readFile, mkdir, cp, rmdir, rm, copyFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import { dirname, relative, resolve } from 'path';
import { existsSync } from 'fs';
import obfuscator from 'javascript-obfuscator';

/**
 * Check if a filepath is valid.
 * @param path {string}
 */
export async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch (err) {}

	return false;
}

/**
 * Spawn a child process and executes the command asynchronously.
 * @param command {string}
 */
export function exec(command) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, { stdio: 'inherit', shell: true });

		child.on('exit', (code, signal) => {
			if (code === 0) {
				resolve({ code, signal });
			} else {
				reject(new Error(`Command '${command}' exited with code ${code} and signal ${signal}`));
			}
		});
	});
}

/**
 * Recursively read the files in a directory and return the paths.
 * @param args {string[]}
 * @return {Promise<string[]>}
 */
export async function getFiles(...args) {
	const files = await Promise.all(
		args.map(async (dir) => {
			try {
				const dirents = await readdir(`${dir}/`, { withFileTypes: true });
				const paths = await Promise.all(
					dirents.map(async (dirent) => {
						const path = `${dir}/${dirent.name}`;
						return dirent.isDirectory() ? await getFiles(path) : path;
					})
				);

				return paths.flat();
			} catch (err) {
				return [];
			}
		})
	);

	return files.flat();
}

export async function getPackage() {
	return JSON.parse(await readFile('package.json', 'utf8'));
}

/**
 * Kopiert Dateien in das Zielverzeichnis und ersetzt "dist" durch "source".
 * Optional: Obfuskiert .js-Dateien.
 *
 * @param {string[]} files - Liste von Pfaden (relativ oder absolut)
 * @param {string} destBase - Zielverzeichnis (z. B. "server-ready")
 */
export async function copyFilesWithStructure(files, destBase) {
	if (existsSync(destBase)) {
		await rm(destBase, { recursive: true, force: true });
	}

	for (const file of files) {
		const stats = await stat(file);
		if (!stats.isFile()) continue;

		// Berechne Zielpfad (inkl. "dist" -> "source")
		let relativePath = file.replaceAll('\\', '/');
		// if (relativePath.startsWith('./')) relativePath = relativePath.slice(2);
		// if (relativePath.includes('dist')) {
		// 	relativePath = relativePath.replace('dist', 'source');
		// }

		const destPath = resolve(destBase, relativePath);
		await mkdir(dirname(destPath), { recursive: true });

		if (file.endsWith('.js')) {
			const sourceCode = await readFile(file, 'utf-8');
			const obfuscatedCode = obfuscator
				.obfuscate(sourceCode, {
					compact: true,
					identifierNamesGenerator: 'mangled',
					deadCodeInjection: true,
					stringArray: true,
					stringArrayEncoding: ['base64'],
				})
				.getObfuscatedCode();

			await writeFile(destPath, obfuscatedCode);
		} else {
			await copyFile(file, destPath);
		}
	}
}
