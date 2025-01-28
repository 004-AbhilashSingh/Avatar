import { Component, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {
  @ViewChild('rendererContainer', { static: true }) rendererContainer!: ElementRef;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private mixer!: THREE.AnimationMixer;
  private clock = new THREE.Clock();
  private currentAction!: THREE.AnimationAction;
  private model!: THREE.Object3D;
  private morphTargetDictionary:any;
  private audio!: HTMLAudioElement;
  private mouthCues:any[] = [];
  showAvatar:boolean = false;

  public animations = [
    { name: 'Idle', file: 'Idle.fbx' },
    { name: 'Talking', file: 'Talking.fbx' }
  ];

  private corresponding = {
    A: "viseme_PP",
    B: "viseme_kk",
    C: "viseme_I",
    D: "viseme_AA",
    E: "viseme_O",
    F: "viseme_U",
    G: "viseme_FF",
    H: "viseme_TH",
    X: "viseme_PP",
  };

  ngAfterViewInit() {
    this.initThreeJs();
    this.loadGLBModel();
    this.loadLipSyncData();
    this.animate();
    this.showAvatar = true;
  }


  private initThreeJs() {
    // Initialize scene
    this.scene = new THREE.Scene();
    const textureLoader = new THREE.TextureLoader();
    const backgroundTexture = textureLoader.load('images/background_image.jpg');
    this.scene.background = backgroundTexture;

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(1, 0.75, 1.5);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 3.5);
    light.position.set(0, 2, 2.5);
    this.scene.add(light);
  }

  private loadGLBModel() {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('Models/67973ec3ce104c6ffee38909.glb', (gltf) => {
      console.log(gltf);
      this.model = gltf.scene;
      this.scene.add(this.model);
      this.model.position.set(0, -3.5, 0);
      this.model.scale.set(2.5,2.5,2.5);
      setTimeout(() => {
        this.extractMorphTargets();
      },10000);

      // Initialize Animation Mixer
      this.mixer = new THREE.AnimationMixer(this.model);

      // Load FBX Animation after GLB model is ready
      this.loadFBXAnimation(this.animations[0].file);
    }, undefined, (error) => {
      console.error('Error loading GLB model', error);
    });
  }

  private extractMorphTargets() {
    if (!this.model) {
      console.error('Character model is not loaded yet.');
      return;
    }

    let skinnedMesh: THREE.SkinnedMesh | null = null;

    this.model.traverse((child) => {
      if (child.name === "Wolf3D_Head") {
        skinnedMesh = child as THREE.SkinnedMesh;
        console.log("✅ Found Skinned Mesh:", skinnedMesh);
      }
    });

    if (!skinnedMesh) {
      console.error('Error: Skinned Mesh "CharacterMesh" not found in the GLB.');
      console.log('Available Objects:', this.model);
      return;
    }
  
    if ((skinnedMesh as THREE.SkinnedMesh).morphTargetDictionary) {
      this.morphTargetDictionary = (skinnedMesh as THREE.SkinnedMesh).morphTargetDictionary;
      console.log('Morph Targets Loaded:', this.morphTargetDictionary);
    } else {
      console.error('Error: Morph Targets not found in the model.');
    }
  }

  private loadFBXAnimation(animationFile:string) {
    const fbxLoader = new FBXLoader();
    fbxLoader.load(`animations/${animationFile}`, (fbx) => {
      if (this.currentAction) {
        this.currentAction.fadeOut(0.5); // Smooth transition
      }

      const animationClip = fbx.animations[0];
      const newAction = this.mixer.clipAction(animationClip);

      newAction.reset().fadeIn(0.5).play();
      this.currentAction = newAction;
    }, undefined, (error) => {
      console.error('Error loading FBX animation', error);
    });
  }

  private loadLipSyncData() {
    fetch('audios/output2.json')
      .then(response => response.json())
      .then(data => {
        this.mouthCues = data.mouthCues;
      })
      .catch(error => console.error('Error loading lip sync data:', error));
  }

  public playAudio() {
    if (!this.mouthCues.length) {
      console.error('Lip sync data not loaded.');
      return;
    }

    this.audio = new Audio('audios/sample2.wav');
    this.audio.addEventListener("loadedmetadata", () => {
      console.log('Audio Duration:', this.audio.duration);
      this.audio.play();
      this.loadFBXAnimation("Talking.fbx");
      this.startLipSync();
    });

  }

  private startLipSync() {
    const startTime = performance.now();
    const updateLipSync = () => {
      const elapsed = (performance.now() - startTime) / 1000; // Convert to seconds
      console.log(elapsed);
      for (const cue of this.mouthCues) {
        if (elapsed >= cue.start && elapsed <= cue.end) {
          this.setViseme(cue.value);
          break;
        }
      }

      if (elapsed < this.audio.duration) {
        requestAnimationFrame(updateLipSync);
      }
    };

    updateLipSync();
  }

  private setViseme(visemeKey: keyof typeof this.corresponding) {
    if (!this.model || !this.morphTargetDictionary) return;

    const visemeName = this.corresponding[visemeKey];
    console.log(visemeKey);
    if (visemeName !== undefined && visemeName in this.morphTargetDictionary) {
      let skinnedMesh: THREE.SkinnedMesh | null = null;

      this.model.traverse((child) => {
        if (child.name === "Wolf3D_Head") {
          skinnedMesh = child as THREE.SkinnedMesh;
          console.log("✅ Found Skinned Mesh:", skinnedMesh);
        }
      });
      if (skinnedMesh) {
        const morphIndex = this.morphTargetDictionary[visemeName];

        // Reset all morph targets
        (skinnedMesh as THREE.SkinnedMesh).morphTargetInfluences!.fill(0);

        // Activate the correct viseme
        (skinnedMesh as THREE.SkinnedMesh).morphTargetInfluences![morphIndex] = 1;
      }
    }
  }

  public changeAnimation(event: Event) {
    const selectedAnimation = (event.target as HTMLSelectElement).value;
    console.log('Selected Animation:', selectedAnimation);
    const animFile = this.animations.find(anim => anim.name === selectedAnimation)?.file;
    console.log('Animation File:', animFile);
    if (animFile) {
      this.loadFBXAnimation(animFile);
    }
  }
  

  private animate = () => {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    if (this.mixer) this.mixer.update(delta);

    if(this.model){
      const cameraPos = new THREE.Vector3(this.camera.position.x+0.3, this.model.position.y, this.camera.position.z);
      this.model.lookAt(cameraPos);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

}
