const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

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
    sessionToken: process.env.AWS_SESSION_TOKEN || undefined
  }
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Multer en memoria
const upload = multer({ storage: multer.memoryStorage() });

// RUTA PARA VALIDAR EL LOGIN (Puedes cambiar usuario y contraseña aquí)
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Credenciales de ejemplo para el docente
  const ADMIN_USER = 'Docker';
  const ADMIN_PASS = '12345';

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.status(200).json({ message: 'Autenticación exitosa' });
  } else {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
});

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

// Ruta para DESCARGAR archivos desde S3
app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: filename
    };

    const command = new GetObjectCommand(params);
    const response = await s3.send(command);

    res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    response.Body.pipe(res);
  } catch (error) {
    console.error('Error al descargar archivo de S3:', error);
    res.status(500).json({ error: 'No se pudo descargar el archivo' });
  }
});

app.listen(port, () => {
  console.log(`Backend corriendo en el puerto ${port}`);
});