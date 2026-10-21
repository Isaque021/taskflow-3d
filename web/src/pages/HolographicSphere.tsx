
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh } from "three";

function Sphere() {
    const sphereRef = useRef<Mesh>(null);

    useFrame((state, delta) => {
        if (!sphereRef.current) return;

        sphereRef.current.rotation.y += delta * 0.18;
        sphereRef.current.rotation.x += delta * 0.08;
        sphereRef.current.position.y =
            Math.sin(state.clock.elapsedTime * 0.7) * 0.08;
    });

    return (
        <Float speed={1.1} rotationIntensity={0.18} floatIntensity={0.25}>
            <mesh ref={sphereRef}>
                <icosahedronGeometry args={[1.05, 5]} />
                <meshPhysicalMaterial
                    color="#66eaff"
                    roughness={0.18}
                    metalness={0.55}
                    transmission={0.22}
                    thickness={0.8}
                    clearcoat={1}
                    emissive="#4c43ff"
                    emissiveIntensity={0.42}
                    wireframe
                />
            </mesh>
            <mesh scale={0.78}>
                <icosahedronGeometry args={[1.05, 3]} />
                <meshBasicMaterial
                    color="#9b7bff"
                    wireframe
                    transparent
                    opacity={0.42}
                />
            </mesh>
        </Float>
    );
}

export function HolographicSphere() {
    return (
        <div className="holographic-sphere" aria-hidden="true">
            <Canvas camera={{ position: [0, 0, 3.8], fov: 45 }} dpr={[1, 1.5]}>
                <ambientLight intensity={0.7} />
                <pointLight position={[2, 2, 3]} intensity={18} color="#43e8ff" />
                <pointLight position={[-2, -1, 1]} intensity={12} color="#9c70ff" />
                <Sphere />
            </Canvas>
        </div>
    );
}
