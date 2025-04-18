import { Component, ElementRef, Inject, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { AlertController, AnimationController, InfiniteScrollCustomEvent, ModalController, Platform } from '@ionic/angular';
import { BehaviorSubject, lastValueFrom, Observable, Subscription } from 'rxjs';
import { Group } from 'src/app/core/models/group.model';
import { Paginated } from 'src/app/core/models/paginated.model';
import { Person } from 'src/app/core/models/person.model';
import { GroupsService } from 'src/app/core/services/impl/groups.service';
import { PeopleService } from 'src/app/core/services/impl/people.service';
import { TranslateService } from '@ngx-translate/core';
import { PersonModalComponent } from 'src/app/shared/components/person-modal/person-modal.component';
import { PEOPLE_COLLECTION_SUBSCRIPTION_TOKEN } from 'src/app/core/repositories/repository.tokens';
import { ICollectionSubscription } from 'src/app/core/services/interfaces/collection-subscription.interface';
import { CollectionChange } from 'src/app/core/services/interfaces/collection-subscription.interface';


@Component({
  selector: 'app-people',
  templateUrl: './people.page.html',
  styleUrls: ['./people.page.scss'],
})
export class PeoplePage implements OnInit {
  portsSubscription!: Subscription;
  _people:BehaviorSubject<Person[]> = new BehaviorSubject<Person[]>([]);
  people$:Observable<Person[]> = this._people.asObservable();
  public alertYesNoButtons = [
    {
      text: 'No',
      role: 'no'
    },
    {
      text: 'Yes',
      role: 'yes'
    },
  ];
  isWeb: boolean = false;
  private loadedIds: Set<string> = new Set(); // Mantener registro de IDs cargados

  constructor(
    private animationCtrl: AnimationController,
    private peopleSvc:PeopleService,
    private groupSvc:GroupsService,
    private modalCtrl:ModalController,
    private translate: TranslateService,
    private alertCtrl: AlertController,
    private platform: Platform,
    @Inject(PEOPLE_COLLECTION_SUBSCRIPTION_TOKEN) 
    private peopleSubscription: ICollectionSubscription<Person>
  ) {
    this.isWeb = this.platform.is('desktop');
  }

  ngOnInit(): void {
    this.loadGroups();
    this.peopleSubscription.subscribe('people').subscribe((change: CollectionChange<Person>) => {
      const currentPeople = [...this._people.value];
      
      // Solo procesar cambios de documentos que ya tenemos cargados
      if (!this.loadedIds.has(change.id) && change.type !== 'added') {
        return;
      }

      switch(change.type) {
        case 'added':
        case 'modified':
          const index = currentPeople.findIndex(p => p.id === change.id);
          if (index >= 0) {
            currentPeople[index] = change.data!;
          }
          break;
        case 'removed':
          const removeIndex = currentPeople.findIndex(p => p.id === change.id);
          if (removeIndex >= 0) {
            currentPeople.splice(removeIndex, 1);
            this.loadedIds.delete(change.id);
          }
          break;
      }
      
      this._people.next(currentPeople);
    });
  }


  @ViewChildren('avatar') avatars!: QueryList<ElementRef>;
  @ViewChild('animatedAvatar') animatedAvatar!: ElementRef;
  @ViewChild('animatedAvatarContainer') animatedAvatarContainer!: ElementRef;

  selectedPerson: any = null;
  isAnimating = false;
  page:number = 1;
  pageSize:number = 25;
  pages:number = 0;


  loadGroups(){
    this.page=1;
    this.peopleSvc.getAll(this.page, this.pageSize).subscribe({
      next:(response:Paginated<Person>)=>{
        // Actualizar el registro de IDs cargados
        response.data.forEach(person => this.loadedIds.add(person.id));
        this._people.next([...response.data]);
        this.page++;
        this.pages = response.pages;
      }
    });
  }


  loadMorePeople(notify:HTMLIonInfiniteScrollElement | null = null) {
    if(this.page<=this.pages){
      this.peopleSvc.getAll(this.page, this.pageSize).subscribe({
        next:(response:Paginated<Person>)=>{
          // Actualizar el registro de IDs cargados
          response.data.forEach(person => this.loadedIds.add(person.id));
          this._people.next([...this._people.value, ...response.data]);
          this.page++;
          notify?.complete();
        }
      });
    }
    else{
      notify?.complete();
    }
    
  }

  async openPersonDetail(person: any, index: number) {
    await this.presentModalPerson('edit', person);
    this.selectedPerson = person;
    /*
    const avatarElements = this.avatars.toArray();
    const clickedAvatar = avatarElements[index].nativeElement;

    // Obtener las coordenadas del avatar clicado
    const avatarRect = clickedAvatar.getBoundingClientRect();

    // Mostrar el contenedor animado
    this.isAnimating = true;
    

    // Configurar la posición inicial de la imagen animada
    const animatedAvatarElement = this.animatedAvatar.nativeElement as HTMLElement;
    animatedAvatarElement.style.position = 'absolute';
    animatedAvatarElement.style.top = `${avatarRect.top}px`;
    animatedAvatarElement.style.left = `${avatarRect.left}px`;
    animatedAvatarElement.style.width = `${avatarRect.width}px`;
    animatedAvatarElement.style.height = `${avatarRect.height}px`;

    // Crear la animación
    const animation = this.animationCtrl.create()
      .addElement(animatedAvatarElement)
      .duration(500)
      .easing('ease-out')
      .fromTo('transform', 'translate(0, 0) scale(1)', `translate(${window.innerWidth / 2 - avatarRect.left - avatarRect.width / 2}px, ${window.innerHeight / 2 - avatarRect.top - avatarRect.height / 2}px) scale(5)`);

    // Iniciar la animación
    await animation.play();

    // Opcional: Puedes agregar lógica adicional después de la animación
    // Por ejemplo, mostrar más información, navegar a otra página, etc.

    // Resetear la animación después de completarla
    //this.isAnimating = false;
    */
  }

  onIonInfinite(ev:InfiniteScrollCustomEvent) {
    this.loadMorePeople(ev.target);
    
  }

  private async presentModalPerson(mode:'new'|'edit', person:Person|undefined=undefined){
    let _groups:Group[] = await lastValueFrom(this.groupSvc.getAll())
    const modal = await this.modalCtrl.create({
      component:PersonModalComponent,
      componentProps:(mode=='edit'?{
        person: person,
        groups: _groups
      }:{
        groups: _groups
      })
    });
    modal.onDidDismiss().then((response:any)=>{
      switch (response.role) {
        case 'new':
          this.peopleSvc.add(response.data).subscribe({
            next:res=>{
              this.loadGroups();
            },
            error:err=>{}
          });
          break;
        case 'edit':
          this.peopleSvc.update(person!.id, response.data).subscribe({
            next:res=>{
              this.loadGroups();
            },
            error:err=>{}
          });
          break;
        default:
          break;
      }
    });
    await modal.present();
  }

  async onAddPerson(){
    await this.presentModalPerson('new');
  }

  async onDeletePerson(person: Person) {
    const alert = await this.alertCtrl.create({
      header: await this.translate.get('PEOPLE.MESSAGES.DELETE_CONFIRM').toPromise(),
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'OK',
          role: 'yes',
          handler: () => {
            this.peopleSvc.delete(person.id).subscribe({
              next: response => {
                this.loadGroups();
              },
              error: err => {}
            });
          }
        }
      ]
    });

    await alert.present();
  }

  

}
