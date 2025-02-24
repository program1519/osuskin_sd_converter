const express = require('express');
const multer = require('multer');
const unzipper = require('unzipper');
const sharp = require('sharp');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.single('skin'), async (req, res) => {
    const zipPath = req.file.path;
    const outputDir = 'output/';

    fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: outputDir }))
        .on('close', async () => {
            await processImages(outputDir);

            const outputZip = 'SD_skin.zip';
            await zipDirectory(outputDir, outputZip);

            res.download(outputZip, () => {
                fs.unlinkSync(zipPath);
                fs.rmdirSync(outputDir, { recursive: true });
                fs.unlinkSync(outputZip);
            });
        });
});

async function processImages(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const filePath = path.join(directory, file);

        if (file.endsWith('@2x.png') || file.endsWith('@2x.jpg')) {
            try {
                const metadata = await sharp(filePath).metadata();

                if (metadata.width > 0) {
                    const newFilePath = filePath.replace('@2x', '');

                    await sharp(filePath)
                        .resize({ width: Math.floor(metadata.width * 0.5) })
                        .toFile(newFilePath);

                    fs.unlinkSync(filePath);
                } else {
                    console.error(`Skipping ${file}: Invalid image width.`);
                }
            } catch (err) {
                console.error(`Error processing ${file}: ${err.message}`);
            }
        }
    }
}

function zipDirectory(source, out) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(out);

    return new Promise((resolve, reject) => {
        archive
            .directory(source, false)
            .on('error', err => reject(err))
            .pipe(stream);

        stream.on('close', () => resolve());
        archive.finalize();
    });
}

app.listen(8080, () => console.log('Server is running :D'));
