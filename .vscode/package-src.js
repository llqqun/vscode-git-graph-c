const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC_DIRECTORY = './src';
const OUT_DIRECTORY = './out';
const ASKPASS_DIRECTORY = 'askpass';
const I18N_DIRECTORY = 'i18n';

// Adjust any scripts that require the Node.js File System Module to use the Node.js version (as Electron overrides the fs module with its own version of the module)
fs.readdirSync(OUT_DIRECTORY).forEach((fileName) => {
	if (fileName.endsWith('.js')) {
		const scriptFilePath = path.join(OUT_DIRECTORY, fileName);
		const mapFilePath = scriptFilePath + '.map';

		let script = fs.readFileSync(scriptFilePath).toString();
		if (script.match(/require\("fs"\)/g)) {
			// Adjust the requirement
			script = script.replace('"use strict";', '"use strict";\r\nfunction requireWithFallback(electronModule, nodeModule) { try { return require(electronModule); } catch (err) {} return require(nodeModule); }');
			fs.writeFileSync(scriptFilePath, script.replace(/require\("fs"\)/g, 'requireWithFallback("original-fs", "fs")'));

			// Adjust the mapping file, as we added requireWithFallback on a new line at the start of the file.
			let data = JSON.parse(fs.readFileSync(mapFilePath).toString());
			data.mappings = ';' + data.mappings;
			fs.writeFileSync(mapFilePath, JSON.stringify(data));
		}
	}
});

// Copy the askpass shell scripts to the output directory
fs.readdirSync(path.join(SRC_DIRECTORY, ASKPASS_DIRECTORY)).forEach((fileName) => {
	if (fileName.endsWith('.sh')) {
		// If the file is a shell script, read its contents and write it to the output directory
		const scriptContents = fs.readFileSync(path.join(SRC_DIRECTORY, ASKPASS_DIRECTORY, fileName)).toString();
		fs.writeFileSync(path.join(OUT_DIRECTORY, ASKPASS_DIRECTORY, fileName), scriptContents);
	}
});

// Copy the i18n JSON files to the output directory
const i18nSrcDir = path.join(SRC_DIRECTORY, I18N_DIRECTORY);
const i18nOutDir = path.join(OUT_DIRECTORY, I18N_DIRECTORY);
if (!fs.existsSync(i18nOutDir)) {
	fs.mkdirSync(i18nOutDir);
}
fs.readdirSync(i18nSrcDir).forEach((fileName) => {
	if (fileName.endsWith('.json')) {
		const jsonContents = fs.readFileSync(path.join(i18nSrcDir, fileName)).toString();
		fs.writeFileSync(path.join(i18nOutDir, fileName), jsonContents);
	}
});
