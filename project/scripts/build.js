import { build } from 'esbuild';
import { exists, exec, getFiles, copyFilesWithStructure, getPackage, findEntryPoints } from './utils.js';
import { writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';

const watch = process.argv.includes('--watch');
const web = await exists('./web');
const pkg = await getPackage();

const baseConfig = {
	keepNames: true,
	legalComments: 'inline',
	bundle: true,
	minify: !watch,
	minifyIdentifiers: !watch,
	minifySyntax: !watch,
	minifyWhitespace: !watch,
	treeShaking: true,
	sourcemap: watch ? 'inline' : false,
	logLevel: 'info',
	metafile: true,
};

const dropLabels = ['$BROWSER'];
if (!watch) dropLabels.push('$DEV');

const serverEntryPoints = await findEntryPoints('src/server');
const clientEntryPoints = await findEntryPoints('src/client');
const sharedEntryPoints = await findEntryPoints('src/shared');

console.log(`📁 Found ${serverEntryPoints.length} server entry points`);
console.log(`📁 Found ${clientEntryPoints.length} client entry points`);
console.log(`📁 Found ${sharedEntryPoints.length} shared entry points`);

const serverConfig = {
	...baseConfig,
	entryPoints: [...serverEntryPoints, ...sharedEntryPoints],
	outdir: 'dist/server',
	platform: 'node',
	target: ['node22'],
	format: 'cjs',
	dropLabels: [...dropLabels, '$CLIENT'],
	external: ['@citizenfx/server'],
};

const clientConfig = {
	...baseConfig,
	entryPoints: [...clientEntryPoints, ...sharedEntryPoints],
	outdir: 'dist/client',
	platform: 'browser',
	target: ['es2021'],
	format: 'iife',
	dropLabels: [...dropLabels, '$SERVER'],
	external: ['@citizenfx/client'],
};

async function createFxmanifest(config) {
	const manifest = `fx_version 'cerulean'
game 'gta5'

name '${pkg.name || 'Unknown'}'
version '${pkg.version || '1.0.0'}'
description '${pkg.description || ''}'
author '${pkg.author || 'Unknown'}'

lua54 'yes'
use_experimental_fxv2_oal 'yes'

${
	config.client_scripts
		? `client_scripts {
    ${config.client_scripts.map((script) => `'${script}'`).join(',\n    ')}
}`
		: ''
}

${
	config.server_scripts
		? `server_scripts {
    ${config.server_scripts.map((script) => `'${script}'`).join(',\n    ')}
}`
		: ''
}

${
	config.files
		? `files {
    ${config.files.map((file) => `'${file}'`).join(',\n    ')}
}`
		: ''
}

${config.metadata?.ui_page ? `ui_page '${config.metadata.ui_page}'` : ''}

${
	config.dependencies
		? `dependencies {
    ${config.dependencies.map((dep) => `'${dep}'`).join(',\n    ')}
}`
		: ''
}
`;

	await writeFile('fxmanifest.lua', manifest);
	console.log('✅ fxmanifest.lua created');
}

function collectOutputFiles(results) {
	const outputs = {
		client: [],
		server: [],
	};

	results.forEach((result, index) => {
		if (result.metafile && result.metafile.outputs) {
			const type = index === 0 ? 'server' : 'client';
			outputs[type] = Object.keys(result.metafile.outputs)
				.filter((file) => file.endsWith('.js'))
				.map((file) => file.replaceAll('\\', '/'));
		}
	});

	return outputs;
}

const watchPlugin = {
	name: 'watch-plugin',
	setup(build) {
		build.onEnd(async (result) => {
			if (result.errors.length > 0) {
				console.error('❌ Build failed:', result.errors);
				return;
			}
			console.log(`✅ ${build.initialOptions.platform} build completed`);
		});
	},
};

async function runBuild() {
	try {
		console.log('🚀 Starting ESBuild...');

		if (watch) {
			const contexts = [];

			if (serverConfig.entryPoints.length > 0) {
				const serverContext = await build({
					...serverConfig,
					plugins: [watchPlugin],
					watch: true,
				});
				contexts.push(serverContext);
				console.log('👀 Server watching for changes...');
			}

			if (clientConfig.entryPoints.length > 0) {
				const clientContext = await build({
					...clientConfig,
					plugins: [watchPlugin],
					watch: true,
				});
				contexts.push(clientContext);
				console.log('👀 Client watching for changes...');
			}

			if (web) {
				console.log('🌐 Starting web watch mode...');
				exec('cd ./web && vite build --watch');
			}

			console.log('👀 All builds are watching for changes...');
			return;
		}

		if (!watch) {
			const buildPromises = [];

			if (serverConfig.entryPoints.length > 0) {
				buildPromises.push(build(serverConfig));
			}

			if (clientConfig.entryPoints.length > 0) {
				buildPromises.push(build(clientConfig));
			}

			if (buildPromises.length === 0) {
				console.warn('⚠️  No entry points found for building');
				return;
			}

			const results = await Promise.all(buildPromises);
			const outputs = collectOutputFiles(results);

			console.log('Server outputs:', outputs.server);
			console.log('Client outputs:', outputs.client);

			if (web) {
				console.log('🌐 Building web...');
				await exec('cd ./web && vite build');
			}

			const staticFiles = await getFiles('dist/web', 'static', 'locales');

			const normalizedFiles = staticFiles.map((file) => file.replaceAll('\\', '/'));

			await createFxmanifest({
				client_scripts: outputs.client,
				server_scripts: outputs.server,
				files: ['lib/init.lua', 'lib/client/**.lua', 'locales/*.json', ...normalizedFiles],
				dependencies: ['/server:13068', '/onesync'],
				metadata: {
					ui_page: 'dist/web/index.html',
					node_version: '22',
				},
			});

			console.log(outputs.client.length > 0 ? '✅ Client build completed' : '⚠️  Client build skipped (no entry points)');
			console.log(outputs.server.length > 0 ? '✅ Server build completed' : '⚠️  Server build skipped (no entry points)');

			const allFiles = await getFiles('dist', 'static', 'locales', 'web/dist');
			await copyFilesWithStructure([...allFiles, 'fxmanifest.lua'], 'server-ready');

			console.log('✅ Build completed successfully!');
		} else {
			if (web) {
				console.log('🌐 Starting web watch mode...');
				exec('cd ./web && vite build --watch');
			}

			console.log('👀 All builds are watching for changes...');
		}
	} catch (error) {
		console.error('❌ Build failed:', error);
		process.exit(1);
	}
}

runBuild();
