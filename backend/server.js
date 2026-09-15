const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

// Configuración de AWS S3 con variables de entorno
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN || undefined // Opcional si usas tokens temporales
  }
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Multer en memoria (los archivos van directo a S3 sin guardarse en disco)
const upload = multer({ storage: multer.memoryStorage() });

// Ruta para SUBIR archivos a S3
app.post('/upload', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó ningún archivo' });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    };

    await s3.send(new PutObjectCommand(params));
    res.json({ message: 'Archivo subido exitosamente a S3', fileName });
  } catch (error) {
    console.error('Error al subir a S3:', error);
    res.status(500).json({ error: 'Error en el servidor al subir a S3' });
  }
});

// Ruta para LISTAR los archivos de S3
app.get('/files', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
    const response = await s3.send(command);

    const files = response.Contents ? response.Contents.map(item => ({
      name: item.Key,
      size: item.Size,
      lastModified: item.LastModified
    })) : [];

    res.json(files);
  } catch (error) {
    console.error('Error al listar archivos de S3:', error);
    res.status(500).json({ error: 'Error al listar los archivos' });
  }
});

app.listen(port, () => {
  console.log(`Backend corriendo en el puerto ${port}`);
});