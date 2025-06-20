import { stat, readdir, readFile, mkdir, cp, rmdir, rm, copyFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import { dirname, relative, resolve, join } from 'path';
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
	} catch (err) {
		return false;
	}
}

/**
 * Spawn a child process and executes the command asynchronously.
 * @param command {string}
 * @param options {object} - Additional spawn options
 */
export function exec(command, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, {
			stdio: 'inherit',
			shell: true,
			...options,
		});

		child.on('exit', (code, signal) => {
			if (code === 0) {
				resolve({ code, signal });
			} else {
				reject(new Error(`Command '${command}' exited with code ${code} and signal ${signal}`));
			}
		});

		child.on('error', (error) => {
			reject(error);
		});
	});
}

/**
 * Recursively read the files in a directory and return the paths.
 * @param args {string[]}
 * @return {Promise<string[]>}
 */
export async function getFiles(...args) {
	console.log(`🔍 Searching for files in directories: ${args.join(', ')}`);

	const files = await Promise.all(
		args.map(async (dir) => {
			console.log(`📂 Processing directory: ${dir}`);
			try {
				if (!(await exists(dir))) {
					console.log(`⚠️  Directory does not exist: ${dir}`);
					return [];
				}

				const dirents = await readdir(dir, { withFileTypes: true });
				console.log(`📋 Found ${dirents.length} entries in ${dir}`);

				const paths = await Promise.all(
					dirents.map(async (dirent) => {
						const path = join(dir, dirent.name);
						if (dirent.isDirectory()) {
							console.log(`📁 Recursing into subdirectory: ${path}`);
							return await getFiles(path);
						} else {
							console.log(`📄 Found file: ${path}`);
							return path;
						}
					})
				);
				return paths.flat();
			} catch (err) {
				console.warn(`⚠️  Could not read directory ${dir}:`, err.message);
				return [];
			}
		})
	);

	const flatFiles = files.flat();
	console.log(`📊 Total files found: ${flatFiles.length}`);
	flatFiles.forEach((file, index) => {
		console.log(`   ${index + 1}. ${file}`);
	});

	return flatFiles;
}

/**
 * Get package.json content
 * @return {Promise<object>}
 */
export async function getPackage() {
	try {
		return JSON.parse(await readFile('package.json', 'utf8'));
	} catch (error) {
		console.error('Could not read package.json:', error.message);
		return {};
	}
}

/**
 * Recursively find all entry points in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} extensions - File extensions to include
 * @return {Promise<string[]>}
 */
export async function findEntryPoints(dir, extensions = ['.js', '.ts']) {
	if (!(await exists(dir))) return [];

	const files = await getFiles(dir);
	return files.filter((file) => extensions.some((ext) => file.endsWith(ext)) && !file.includes('node_modules') && !file.includes('.test.') && !file.includes('.spec.'));
}

/**
 * Kopiert Dateien in das Zielverzeichnis mit optionaler Obfuskation.
 *
 * @param {string[]} files - Liste von Pfaden (relativ oder absolut)
 * @param {string} destBase - Zielverzeichnis (z. B. "server-ready")
 * @param {object} options - Optionen für das Kopieren
 */
export async function copyFilesWithStructure(files, destBase, options = {}) {
	const {
		obfuscateJs = false,
		clean = true,
		preserveStructure = false,
		verbose = true, // Standardmäßig verbose für bessere Diagnose
	} = options;

	console.log(`📂 Starting copy operation to: ${destBase}`);
	console.log(`📋 Files to process: ${files.length}`);
	console.log(`⚙️  Obfuscation enabled: ${obfuscateJs}`);

	if (files.length === 0) {
		console.warn('⚠️  No files provided to copy!');
		return;
	}

	// Zielverzeichnis leeren wenn gewünscht
	if (clean && existsSync(destBase)) {
		console.log(`🗑️  Cleaning directory: ${destBase}`);
		await rm(destBase, { recursive: true, force: true });
	}

	let copiedCount = 0;
	let obfuscatedCount = 0;
	let skippedCount = 0;
	let errorCount = 0;

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		console.log(`\n[${i + 1}/${files.length}] Processing: ${file}`);

		try {
			// Prüfe ob Datei existiert
			if (!(await exists(file))) {
				console.error(`❌ File does not exist: ${file}`);
				errorCount++;
				continue;
			}

			const stats = await stat(file);
			if (!stats.isFile()) {
				console.log(`⏭️  Skipping non-file: ${file}`);
				skippedCount++;
				continue;
			}

			console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

			// Berechne Zielpfad
			let relativePath = file.replaceAll('\\', '/');
			if (relativePath.startsWith('./')) {
				relativePath = relativePath.slice(2);
			}

			const destPath = resolve(destBase, relativePath);
			console.log(`🎯 Destination: ${destPath}`);

			// Stelle sicher, dass das Zielverzeichnis existiert
			const destDir = dirname(destPath);
			await mkdir(destDir, { recursive: true });
			console.log(`📁 Created directory: ${destDir}`);

			// JavaScript-Dateien obfuskieren
			if (obfuscateJs && file.endsWith('.js')) {
				console.log(`🔐 Attempting to obfuscate JS file...`);
				try {
					const sourceCode = await readFile(file, 'utf-8');
					console.log(`📖 Read source code (${sourceCode.length} characters)`);

					const obfuscatedCode = obfuscator
						.obfuscate(sourceCode, {
							compact: true,
							identifierNamesGenerator: 'mangled',
							deadCodeInjection: true,
							stringArray: true,
							stringArrayEncoding: ['base64'],
							transformObjectKeys: true,
							unicodeEscapeSequence: false,
						})
						.getObfuscatedCode();

					console.log(`🔒 Obfuscated code (${obfuscatedCode.length} characters)`);
					await writeFile(destPath, obfuscatedCode);
					obfuscatedCount++;
					console.log(`✅ Successfully obfuscated and saved!`);
				} catch (obfError) {
					console.warn(`⚠️  Could not obfuscate ${file}, copying as-is:`);
					console.warn(`   Error: ${obfError.message}`);
					await copyFile(file, destPath);
					console.log(`📄 Copied without obfuscation`);
				}
			} else {
				console.log(`📄 Copying file (not JS or obfuscation disabled)...`);
				await copyFile(file, destPath);
				console.log(`✅ Successfully copied!`);
			}

			copiedCount++;
		} catch (error) {
			console.error(`❌ Error processing file ${file}:`);
			console.error(`   ${error.message}`);
			console.error(`   Stack: ${error.stack}`);
			errorCount++;
		}
	}

	console.log('\n📈 COPY OPERATION SUMMARY:');
	console.log(`   Total files processed: ${files.length}`);
	console.log(`   ✅ Successfully copied: ${copiedCount}`);
	console.log(`   🔐 Obfuscated: ${obfuscatedCount}`);
	console.log(`   ⏭️  Skipped: ${skippedCount}`);
	console.log(`   ❌ Errors: ${errorCount}`);
	console.log(`   📂 Destination: ${destBase}`);

	if (errorCount > 0) {
		console.warn(`⚠️  ${errorCount} files had errors during processing!`);
	}
}

/**
 * Watch for file changes and execute callback
 * @param {string[]} paths - Paths to watch
 * @param {Function} callback - Callback to execute on change
 * @param {object} options - Watch options
 */
export async function watchFiles(paths, callback, options = {}) {
	const { debounce = 100 } = options;
	const { watch } = await import('fs');

	let timeout;
	const debouncedCallback = (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => callback(...args), debounce);
	};

	for (const path of paths) {
		if (await exists(path)) {
			watch(path, { recursive: true }, debouncedCallback);
			console.log(`👀 Watching: ${path}`);
		}
	}
}

/**
 * Create a simple file watcher for development
 * @param {string} pattern - Glob pattern to watch
 * @param {Function} onChange - Callback for file changes
 */
export function createWatcher(pattern, onChange) {
	return {
		async start() {
			const files = await getFiles(pattern);
			await watchFiles(files, onChange);
		},
	};
}
