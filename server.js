const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
// const PORT=3000
// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Setup Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'memories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif']
  }
});

// Configure multer for file uploads
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI|| "mongodb+srv://rishabhtripathi2022:rishabh123@cluster0.mty6k.mongodb.net", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// Define Memory Schema
const memorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  imagePublicId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  special:{
    type:String
  }
});

const Memory = mongoose.model('Memory', memorySchema);

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  memoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Memory'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Group = mongoose.model('Group', groupSchema);

// API Routes


// Get all groups
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Group.find();
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new group
app.post('/api/groups', async (req, res) => {
  try {
    const { name, description, memoryIds } = req.body;
    
    const newGroup = new Group({
      name,
      description,
      memoryIds: memoryIds || []
    });

    const savedGroup = await newGroup.save();
    res.status(201).json(savedGroup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a group
app.put('/api/groups/:id', async (req, res) => {
  try {
    const { name, description, memoryIds } = req.body;
    
    const updatedGroup = await Group.findByIdAndUpdate(
      req.params.id,
      { name, description, memoryIds },
      { new: true }
    );
    
    if (!updatedGroup) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    res.json(updatedGroup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a group
app.delete('/api/groups/:id', async (req, res) => {
  try {
    const deletedGroup = await Group.findByIdAndDelete(req.params.id);
    
    if (!deletedGroup) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
})
// Get all memories
app.get('/api/memories', async (req, res) => {
  try {
    const memories = await Memory.find().sort({ createdAt: -1 });
    res.json(memories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new memory
app.post('/api/memories', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const { title, date, description,special } = req.body;
    
    const newMemory = new Memory({
      title,
      date,
      description,
      special,
      imageUrl: req.file.path,
      imagePublicId: req.file.filename
    });

    const savedMemory = await newMemory.save();
    res.status(201).json(savedMemory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a memory
app.delete('/api/memories/:id', async (req, res) => {
    try {
      const memory = await Memory.findById(req.params.id);
      
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      
      // Delete image from Cloudinary
      await cloudinary.uploader.destroy(memory.imagePublicId);
      
      // Delete memory from database
      await Memory.findByIdAndDelete(req.params.id);
      
      res.json({ message: 'Memory deleted successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Update a memory
  app.put('/api/memories/:id', upload.single('image'), async (req, res) => {
    try {
      const memory = await Memory.findById(req.params.id);
      
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      
      const { title, date, description,special } = req.body;
      
      // Update memory data
      memory.title = title || memory.title;
      memory.date = date || memory.date;
      memory.description = description || memory.description;
      memory.special = special || memory.special;
      
      // If a new image is uploacd ded
      if (req.file) {
        // Delete old image from Cloudinary
        await cloudinary.uploader.destroy(memory.imagePublicId);
        
        // Update with new image
        memory.imageUrl = req.file.path;
        memory.imagePublicId = req.file.filename;
      }
      
      const updatedMemory = await memory.save();
      res.json(updatedMemory);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });


// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
